import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_create_tour_public(client: AsyncClient):
    payload = {
        "student_name": "Jane Student",
        "phone": "+254712345678",
        "zone": "Gate A",
        "tour_type": "full_search",
        "amount": 500.0,
        "preferred_date": "2026-09-01",
        "preferred_time": "morning",
    }
    response = await client.post("/api/v1/tours", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["student_name"] == "Jane Student"
    assert data["status"] == "pending_payment"


@pytest.mark.asyncio
async def test_list_tours_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/tours")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_tours_agent(client: AsyncClient):
    user = AuthenticatedUser(id="agent-1", email="agent@rumia.app", role="agent")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/tours")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_my_tours_embeds_listing_and_supports_upcoming_sort(client: AsyncClient):
    from datetime import date, datetime, timezone
    from unittest.mock import AsyncMock, MagicMock, patch

    from app.core.security import AuthenticatedUser, get_current_user
    from app.main import app

    booking = MagicMock()
    for key, value in dict(
        id="b1", student_name="Student", phone="0700000000", listing_id="l1", zone="Z",
        tour_type="specific_hostel", amount=500, preferred_date=date(2026, 11, 1),
        preferred_time="morning", status="confirmed", linked_user_id="u1", agent_id=None,
        contacted=False, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    ).items():
        setattr(booking, key, value)

    booking.listing = None  # the ORM model has no such attribute
    image = MagicMock(r2_url="https://img/1.jpg", display_order=0)
    listing = MagicMock(id="l1", title="Hostel One", area="Area", county="Nyeri", slug="hostel-one", images=[image])

    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id="u1", email="s@r.app", role="student")
    try:
        with (
            patch("app.features.tours.service.TourService.list_my_tours", new_callable=AsyncMock,
                  return_value=([booking], 1)) as list_mock,
            patch("app.features.tours.service.TourService.get_listings_by_id", new_callable=AsyncMock,
                  return_value={"l1": listing}),
        ):
            response = await client.get("/api/v1/tours/me?sort=upcoming")
        assert response.status_code == 200
        assert list_mock.await_args.kwargs["sort"] == "upcoming"
        item = response.json()["items"][0]
        assert item["listing"]["title"] == "Hostel One"
        assert item["listing"]["images"][0]["r2_url"] == "https://img/1.jpg"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_my_tours_rejects_unknown_sort(client: AsyncClient):
    from app.core.security import AuthenticatedUser, get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id="u1", email="s@r.app", role="student")
    try:
        response = await client.get("/api/v1/tours/me?sort=bogus")
        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)
