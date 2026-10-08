"""Integration tests that run real SQL against a Postgres built from the repo's migrations.

Set TEST_DATABASE_URL (postgresql+asyncpg://...) to a database prepared with
`scripts/db-replay-migrations.sh`. Without it these tests are skipped, so `pytest tests/` stays fast.
Each test runs inside a transaction that is rolled back.
"""
from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

# Own-auth signing key for tests that issue tokens (never a real secret).
os.environ.setdefault("AUTH_JWT_SECRET", "ci-test-only-auth-secret-0123456789abcdef")
os.environ.setdefault("AUTH_MODE", "custom")

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


def pytest_collection_modifyitems(config, items):
    if TEST_DATABASE_URL:
        return
    skip = pytest.mark.skip(reason="TEST_DATABASE_URL not set; real-Postgres tests skipped")
    for item in items:
        if "tests_pg" in str(item.fspath):
            item.add_marker(skip)


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(TEST_DATABASE_URL, connect_args={"statement_cache_size": 0})
    async with engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()
    await engine.dispose()


async def make_campus(db: AsyncSession, slug: str | None = None) -> str:
    slug = slug or f"campus-{uuid.uuid4().hex[:8]}"
    row = await db.execute(
        text(
            """
            INSERT INTO campuses (slug, name, city, hero_headline, whatsapp_number, primary_color)
            VALUES (:slug, :name, 'Nyeri', 'h', '+254700000001', '#000000') RETURNING id
            """
        ),
        {"slug": slug, "name": slug.title()},
    )
    return str(row.scalar_one())


async def make_user(db: AsyncSession, email: str | None = None) -> str:
    email = email or f"u{uuid.uuid4().hex[:8]}@example.com"
    row = await db.execute(
        text("INSERT INTO auth.users (email) VALUES (:e) RETURNING id"), {"e": email}
    )
    return str(row.scalar_one())


async def make_agent(db: AsyncSession, campus_id: str, user_id: str | None = None, phone: str = "+254712345678") -> str:
    row = await db.execute(
        text(
            """
            INSERT INTO agents (name, phone, whatsapp, campus_id, user_id)
            VALUES ('Mary', :p, :p, :c, :u) RETURNING id
            """
        ),
        {"p": phone, "c": campus_id, "u": user_id},
    )
    return str(row.scalar_one())


async def make_listing(db: AsyncSession, agent_id: str, campus_id: str, **overrides) -> str:
    values = {
        "title": "Test Hostel",
        "slug": f"test-{uuid.uuid4().hex[:8]}",
        "description": "d",
        "property_type": "hostel",
        "price": 6500,
        "location": "Near Gate A",
        "county": "nyeri",
        "area": "boma",
        "agent_id": agent_id,
        "campus_id": campus_id,
        "is_active": True,
        "pays_commission": False,
    }
    values.update(overrides)
    cols = ", ".join(values)
    params = ", ".join(f":{k}" for k in values)
    row = await db.execute(text(f"INSERT INTO listings ({cols}) VALUES ({params}) RETURNING id"), values)
    return str(row.scalar_one())


async def make_profile(db: AsyncSession, user_id: str, campus_id: str, role: str = "student") -> None:
    await db.execute(
        text("INSERT INTO profiles (id, email, role, campus_id) VALUES (CAST(:i AS uuid), 'x@example.com', :r, CAST(:c AS uuid))"),
        {"i": user_id, "r": role, "c": campus_id},
    )
