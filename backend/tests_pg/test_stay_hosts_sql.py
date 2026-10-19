"""RumiaBnB hosts against real Postgres: the staff list, invite links and handing a managed host to its owner."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.core.errors import ConflictException, NotFoundException
from app.features.catalog.service import project_listing
from app.features.stays import hosts
from app.features.stays.service import StayService, hash_token
from tests_pg.conftest import make_agent, make_campus, make_listing, make_user


async def _managed_host(db):
    """A host as staff create it today: an agent whose login is a placeholder, with one short stay."""
    campus = await make_campus(db)
    placeholder = await make_user(db, email=f"254712{datetime.now().microsecond:06d}@agents.rumia.co.ke")
    agent = await make_agent(db, campus, user_id=placeholder)
    listing = await make_listing(db, agent, campus, title="Regal Cottage", property_type="short_stay")
    await project_listing(db, listing)
    org = (await db.execute(text("SELECT org_id FROM properties WHERE legacy_listing_id = CAST(:l AS uuid)"), {"l": listing})).scalar_one()
    return str(org), agent, listing


@pytest.mark.asyncio
async def test_staff_list_shows_managed_host_without_login(db):
    org, _, listing = await _managed_host(db)
    row = next(h for h in await hosts.list_hosts(db) if h["id"] == org)
    assert row["has_login"] is False and row["claimed_at"] is None
    assert [l["id"] for l in row["listings"]] == [listing]


@pytest.mark.asyncio
async def test_invite_hands_host_and_agent_to_owner(db):
    org, agent, listing = await _managed_host(db)
    staff = await make_user(db)
    owner = await make_user(db)
    invite = await hosts.create_invite(db, org, staff)
    token = invite["url"].split("token=")[1]

    assert (await hosts.claim(db, token, owner))["org_id"] == org
    role = (await db.execute(text("SELECT role FROM org_members WHERE org_id = CAST(:o AS uuid) AND user_id = CAST(:u AS uuid)"), {"o": org, "u": owner})).scalar_one()
    agent_user = (await db.execute(text("SELECT user_id FROM agents WHERE id = CAST(:a AS uuid)"), {"a": agent})).scalar_one()
    assert role == "owner" and str(agent_user) == owner
    assert [o["id"] for o in await hosts.my_host_orgs(db, owner)] == [org]
    row = next(h for h in await hosts.list_hosts(db) if h["id"] == org)
    assert row["has_login"] is True and row["claimed_at"] is not None

    # Opening the link again is harmless for the same person and refused for anyone else.
    await hosts.claim(db, token, owner)
    with pytest.raises(ConflictException):
        await hosts.claim(db, token, await make_user(db))


@pytest.mark.asyncio
async def test_invite_never_takes_a_real_persons_agent(db):
    campus = await make_campus(db)
    real = await make_user(db)
    agent = await make_agent(db, campus, user_id=real)
    listing = await make_listing(db, agent, campus, property_type="short_stay")
    await project_listing(db, listing)
    org = str((await db.execute(text("SELECT org_id FROM properties WHERE legacy_listing_id = CAST(:l AS uuid)"), {"l": listing})).scalar_one())
    token = (await hosts.create_invite(db, org, real))["url"].split("token=")[1]
    other = await make_user(db)
    await hosts.claim(db, token, other)
    agent_user = (await db.execute(text("SELECT user_id FROM agents WHERE id = CAST(:a AS uuid)"), {"a": agent})).scalar_one()
    assert str(agent_user) == real  # membership granted, agent untouched


@pytest.mark.asyncio
async def test_expired_and_unknown_invites(db):
    org, _, _ = await _managed_host(db)
    await db.execute(
        text("INSERT INTO host_invites (org_id, token_hash, expires_at) VALUES (CAST(:o AS uuid), :h, :e)"),
        {"o": org, "h": hash_token("old-token-123"), "e": datetime.now(timezone.utc) - timedelta(days=1)},
    )
    with pytest.raises(ConflictException):
        await hosts.claim(db, "old-token-123", await make_user(db))
    with pytest.raises(NotFoundException):
        await hosts.claim(db, "never-issued-token", await make_user(db))


@pytest.mark.asyncio
async def test_malformed_ids_are_not_found(db):
    with pytest.raises(NotFoundException):
        await StayService.detail(db, "hosts")
    with pytest.raises(NotFoundException):
        await StayService.list_requests(db, org_ids=["nope"])
    with pytest.raises(NotFoundException):
        await hosts.create_invite(db, "nope", "x")
