import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.core.security import AuthenticatedUser, get_current_user, get_optional_current_user
from app.main import app


# ── helpers ──────────────────────────────────────────────────────────────────
def _make_agent_user() -> AuthenticatedUser:
    return AuthenticatedUser(id="agent-id-1", email="agent@rumia.app", role="agent")


def _make_student_user() -> AuthenticatedUser:
    return AuthenticatedUser(id="student-id-1", email="student@rumia.app", role="student")


# ── read endpoint tests (no auth required) ────────────────────────────────────
@pytest.mark.asyncio
async def test_listings_feed_endpoint(client: AsyncClient):
    response = await client.get("/api/v1/listings?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "limit" in data


@pytest.mark.asyncio
async def test_listings_feed_with_filters(client: AsyncClient):
    response = await client.get("/api/v1/listings?campus_slug=dekut&min_price=1000&max_price=20000")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


@pytest.mark.asyncio
async def test_listings_feed_marks_saved_for_authenticated_user(client: AsyncClient):
    from tests.conftest import _make_mock_listing

    listing = _make_mock_listing(id="listing-1", slug="listing-one")
    app.dependency_overrides[get_optional_current_user] = lambda: _make_student_user()
    try:
        with (
            patch(
                "app.features.listings.service.ListingService.get_listings_feed",
                new_callable=AsyncMock,
                return_value=([listing], 1, {"listing-1": 28}),
            ),
            patch(
                "app.features.profiles.service.ProfileService.get_saved_listing_ids",
                new_callable=AsyncMock,
                return_value={"listing-1"},
            ),
        ):
            response = await client.get("/api/v1/listings?page=1&limit=10&sort=views")

        assert response.status_code == 200
        item = response.json()["items"][0]
        assert item["is_saved"] is True
        assert item["views"] == 28
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


@pytest.mark.asyncio
async def test_listing_detail_marks_saved_for_authenticated_user(client: AsyncClient):
    from tests.conftest import _make_mock_listing

    listing = _make_mock_listing(id="listing-1", slug="listing-one")
    app.dependency_overrides[get_optional_current_user] = lambda: _make_student_user()
    try:
        with (
            patch(
                "app.features.listings.service.ListingService.get_listing_by_id_or_slug",
                new_callable=AsyncMock,
                return_value=listing,
            ),
            patch(
                "app.features.profiles.service.ProfileService.get_saved_listing_ids",
                new_callable=AsyncMock,
                return_value={"listing-1"},
            ),
        ):
            response = await client.get("/api/v1/listings/listing-one")

        assert response.status_code == 200
        assert response.json()["is_saved"] is True
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


@pytest.mark.asyncio
async def test_public_listing_detail_returns_active_listing(client: AsyncClient):
    from tests.conftest import _make_mock_listing

    listing = _make_mock_listing(id="listing-active", slug="listing-active", is_active=True)
    listing.agent.slug = None
    with patch(
        "app.features.listings.service.ListingService.get_listing_by_id_or_slug",
        new_callable=AsyncMock,
        return_value=listing,
    ):
        response = await client.get("/api/v1/listings/listing-active")

    assert response.status_code == 200
    assert response.json()["id"] == "listing-active"
    assert response.json()["is_active"] is True


@pytest.mark.asyncio
async def test_public_listing_detail_hides_inactive_listing(client: AsyncClient):
    from tests.conftest import _make_mock_listing

    listing = _make_mock_listing(id="listing-paused", slug="listing-paused", is_active=False)
    listing.agent.slug = None
    with patch(
        "app.features.listings.service.ListingService.get_listing_by_id_or_slug",
        new_callable=AsyncMock,
        return_value=listing,
    ):
        response = await client.get("/api/v1/listings/listing-paused")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_listing_owner_can_read_own_inactive_listing():
    from tests.conftest import _make_mock_listing
    from app.features.listings.router import get_listing

    listing = _make_mock_listing(id="listing-paused", slug="listing-paused", is_active=False)
    listing.agent.slug = None
    owner = _make_agent_user()
    with (
        patch(
            "app.features.listings.service.ListingService.get_listing_by_id_or_slug",
            new_callable=AsyncMock,
            return_value=listing,
        ),
        patch(
            "app.features.profiles.service.ProfileService.get_saved_listing_ids",
            new_callable=AsyncMock,
            return_value=set(),
        ),
    ):
        response = await get_listing("listing-paused", user=owner, db=AsyncMock())

    assert response.is_active is False


@pytest.mark.asyncio
async def test_admin_can_read_inactive_listing():
    from tests.conftest import _make_mock_listing
    from app.features.listings.router import get_listing

    listing = _make_mock_listing(id="listing-paused", slug="listing-paused", is_active=False)
    listing.agent.slug = None
    admin = AuthenticatedUser(id="admin-id", email="admin@rumia.app", role="admin")
    with (
        patch(
            "app.features.listings.service.ListingService.get_listing_by_id_or_slug",
            new_callable=AsyncMock,
            return_value=listing,
        ),
        patch(
            "app.features.profiles.service.ProfileService.get_saved_listing_ids",
            new_callable=AsyncMock,
            return_value=set(),
        ),
    ):
        response = await get_listing("listing-paused", user=admin, db=AsyncMock())

    assert response.is_active is False


@pytest.mark.asyncio
async def test_different_user_cannot_read_inactive_listing():
    from app.core.errors import NotFoundException
    from app.features.listings.router import get_listing
    from tests.conftest import _make_mock_listing

    listing = _make_mock_listing(id="listing-paused", slug="listing-paused", is_active=False)
    listing.agent.slug = None
    with patch(
        "app.features.listings.service.ListingService.get_listing_by_id_or_slug",
        new_callable=AsyncMock,
        return_value=listing,
    ):
        with pytest.raises(NotFoundException):
            await get_listing("listing-paused", user=_make_student_user(), db=AsyncMock())


@pytest.mark.asyncio
async def test_get_listing_not_found(client: AsyncClient):
    response = await client.get("/api/v1/listings/non-existent-listing-slug-12345")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["code"] == "NOT_FOUND"


# ── write endpoint tests (auth required) ──────────────────────────────────────
@pytest.mark.asyncio
async def test_create_listing_unauthorized(client: AsyncClient):
    payload = {
        "title": "New Sunset Hostel",
        "description": "Clean and spacious student rooms near Gate A",
        "price": 6500,
        "location": "Near Gate A",
    }
    response = await client.post("/api/v1/listings", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_listing_student_forbidden(client: AsyncClient):
    """Student role must be rejected (403) from the create endpoint."""
    app.dependency_overrides[get_current_user] = lambda: _make_student_user()
    try:
        payload = {
            "title": "New Sunset Hostel",
            "description": "Clean and spacious student rooms near Gate A",
            "price": 6500,
            "location": "Near Gate A",
        }
        response = await client.post("/api/v1/listings", json=payload)
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_create_listing_agent_success(client: AsyncClient):
    """Agent role must be able to create a listing (201)."""
    app.dependency_overrides[get_current_user] = lambda: _make_agent_user()
    try:
        payload = {
            "title": "New Sunset Hostel",
            "description": "Clean and spacious student rooms near Gate A",
            "price": 6500,
            "location": "Near Gate A",
            "amenities": ["WiFi", "Water 24/7"],
            "room_types": [{"room_type": "Single", "price": 6500, "is_available": True}],
            "image_urls": ["https://pub-r2.dev/sample.jpg"],
        }
        response = await client.post("/api/v1/listings", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Sunset Hostel"
        assert data["price"] == 6500
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_toggle_listing_full(client: AsyncClient):
    """Agent owner must be able to toggle the is_full flag (200)."""
    from unittest.mock import AsyncMock, patch
    from tests.conftest import _make_mock_listing

    mock_listing = _make_mock_listing(id="test-listing-1", slug="test-listing-1")
    mock_listing.agent.user_id = "agent-id-1"

    app.dependency_overrides[get_current_user] = lambda: _make_agent_user()
    try:
        with patch(
            "app.features.listings.service.ListingService.get_listing_by_id_or_slug",
            new_callable=AsyncMock,
            return_value=mock_listing,
        ):
            response = await client.patch(
                "/api/v1/listings/test-listing-1/toggle-full",
                json={"is_full": True},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["is_full"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)
