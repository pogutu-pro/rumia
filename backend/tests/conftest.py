from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock
import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db_session
from app.main import app


class MockScalars:
    def __init__(self, items=None):
        self._items = items or []

    def all(self):
        return self._items


class MockResult:
    """Mock SQLAlchemy result object supporting the API patterns used in services."""

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


def _make_mock_listing(**kwargs):
    """Return a lightweight object that satisfies ListingRead.model_validate."""
    from app.features.listings.models import Listing, Agent
    agent = MagicMock(spec=Agent)
    agent.id = "agent-id-1"
    agent.name = "Test Agent"
    agent.phone = "+254700000000"
    agent.whatsapp = "+254700000000"
    agent.status = "active"
    agent.campus_id = None
    agent.user_id = "agent-id-1"

    from datetime import datetime, timezone
    listing = MagicMock(spec=Listing)
    listing.id = kwargs.get("id", str(uuid.uuid4()))
    listing.title = kwargs.get("title", "Test Hostel")
    listing.slug = kwargs.get("slug", "test-hostel")
    listing.description = "A great hostel"
    listing.price = kwargs.get("price", 6500.0)
    listing.location = "Near Gate A"
    listing.county = "nyeri"
    listing.area = "dekut"
    listing.specific_location = None
    listing.is_full = kwargs.get("is_full", False)
    listing.rating = 0.0
    listing.views = 0
    listing.bathroom_type = "Shared"
    listing.distance_to_campus = None
    listing.security_type = None
    listing.electricity_included = False
    listing.water_included = False
    listing.wifi_included = False
    listing.amenities = []
    listing.latitude = None
    listing.longitude = None
    listing.campus_id = None
    listing.zone_id = None
    listing.is_active = True
    listing.created_at = datetime.now(timezone.utc)
    listing.agent = agent
    listing.images = []
    listing.room_types = []
    return listing


def _make_session_mock():
    """Create an AsyncMock database session that returns sensible defaults."""
    session = AsyncMock()

    async def _execute(stmt, *args, **kwargs):
        return MockResult()

    session.execute = AsyncMock(side_effect=_execute)
    session.flush = AsyncMock(return_value=None)
    session.add = MagicMock()
    session.delete = AsyncMock(return_value=None)
    session.commit = AsyncMock(return_value=None)
    session.rollback = AsyncMock(return_value=None)
    return session


@pytest.fixture(autouse=True)
def override_db_dependency():
    """Autouse fixture providing a safe offline mock database session."""
    async def _mock_get_db() -> AsyncGenerator:
        yield _make_session_mock()

    app.dependency_overrides[get_db_session] = _mock_get_db
    yield
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client fixture for testing API endpoints."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac
