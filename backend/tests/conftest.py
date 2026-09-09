"""
Shared pytest fixtures for the Rumia FastAPI backend test suite.

Key design:
- `override_db_dependency` is a SYNC autouse fixture. It simply patches the
  dependency_overrides dict (which is a synchronous operation) so pytest-asyncio
  has no trouble with sync-vs-async fixture mixing.
- `client` is an async fixture used by tests that make HTTP requests.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

# Ensure a valid JWT secret exists before app.settings is instantiated, so tests
# never exercise the (removed) hardcoded dev fallback. Prod must always set the
# real secret via backend/.env or the environment.
os.environ.setdefault("SUPABASE_JWT_SECRET", "ci-test-only-jwt-secret-9f8a7e6d5c4b")

from app.core.database import get_db_session
from app.main import app


# ── Mock result helpers ───────────────────────────────────────────────────────

class MockScalars:
    def __init__(self, items=None):
        self._items = items or []

    def all(self):
        return self._items


class MockResult:
    """Mock SQLAlchemy AsyncResult."""

    def __init__(self, items=None, single=None, scalar_value=0):
        self._items = items or []
        self._single = single
        self._scalar_value = scalar_value

    def scalars(self) -> MockScalars:
        return MockScalars(self._items)

    def scalar_one_or_none(self):
        return self._single

    def scalar_one(self):
        return self._scalar_value

    def fetchone(self):
        return self._single

    def mappings(self):
        m = MagicMock()
        m.all.return_value = self._items
        m.one_or_none.return_value = self._single
        return m

    def fetchall(self):
        return self._items


# ── Mock domain factories ─────────────────────────────────────────────────────

def _make_mock_listing(**kwargs):
    """Return a MagicMock Listing that passes ListingRead.model_validate."""
    from app.features.listings.models import Agent, Listing  # noqa: PLC0415

    agent = MagicMock(spec=Agent)
    agent.id = kwargs.get("agent_id", "agent-id-1")
    agent.name = "Test Agent"
    agent.phone = "+254700000000"
    agent.whatsapp = "+254700000000"
    agent.status = "active"
    agent.campus_id = None
    agent.user_id = kwargs.get("agent_user_id", "agent-id-1")

    listing = MagicMock(spec=Listing)
    listing.id = kwargs.get("id", str(uuid.uuid4()))
    listing.title = kwargs.get("title", "Test Hostel")
    listing.slug = kwargs.get("slug", "test-hostel")
    listing.description = "A great hostel"
    listing.property_type = kwargs.get("property_type", "hostel")
    listing.price = float(kwargs.get("price", 6500))
    listing.location = "Near Gate A"
    listing.county = "nyeri"
    listing.area = "dekut"
    listing.specific_location = None
    listing.is_full = bool(kwargs.get("is_full", False))
    listing.rating = float(kwargs.get("rating", 0.0))
    listing.views = int(kwargs.get("views", 0))
    listing.bathroom_type = "Shared"
    listing.distance_to_campus = None
    listing.security_type = None
    listing.electricity_included = False
    listing.water_included = False
    listing.wifi_included = False
    listing.amenities = []
    listing.latitude = None
    listing.longitude = None
    listing.campus_id = kwargs.get("campus_id", None)
    listing.zone_id = kwargs.get("zone_id", None)
    listing.is_active = bool(kwargs.get("is_active", True))
    listing.created_at = datetime.now(timezone.utc)
    listing.updated_at = None
    listing.landlord_phone = None
    listing.youtube_id = None
    listing.is_youtube_shorts = False
    listing.distance_category = None
    listing.hot_water_included = False
    listing.cooking_gas_included = False
    listing.room_type = None
    listing.gender = "mixed"
    listing.price_single = None
    listing.price_sharing = None
    listing.pays_commission = False
    listing.sort_order = None
    listing.sort_position = None
    listing.agent = agent
    listing.images = []
    listing.room_types = []
    return listing


def _make_session_mock():
    """Create an AsyncMock DB session with sensible empty defaults."""
    session = AsyncMock()

    async def _execute(_stmt, *args, **kwargs):
        return MockResult()

    session.execute = AsyncMock(side_effect=_execute)
    session.flush = AsyncMock(return_value=None)
    session.refresh = AsyncMock(return_value=None)
    session.add = MagicMock()
    session.delete = AsyncMock(return_value=None)
    session.commit = AsyncMock(return_value=None)
    session.rollback = AsyncMock(return_value=None)
    session.close = AsyncMock(return_value=None)
    return session


# ── Core fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def override_db_dependency():
    """
    SYNC autouse fixture: patches get_db_session with a mock for every test.

    Kept synchronous so pytest-asyncio doesn't fail when sync tests try to use it.
    The mock _mock_get_db is an async generator (valid as a FastAPI dependency).
    """
    async def _mock_get_db() -> AsyncGenerator:
        yield _make_session_mock()

    app.dependency_overrides[get_db_session] = _mock_get_db
    yield
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTPX client wired to the FastAPI ASGI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


@pytest.fixture
async def authed_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Async HTTPX client with a mocked authenticated user injected.
    Used by tests that call protected endpoints.
    """
    from app.core.security import AuthenticatedUser, get_current_user

    mock_user = AuthenticatedUser(
        id=str(uuid.uuid4()),
        email="test@rumia.co.ke",
        role="agent",
    )

    async def _mock_get_current_user():
        return mock_user

    app.dependency_overrides[get_current_user] = _mock_get_current_user
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac
    app.dependency_overrides.pop(get_current_user, None)

