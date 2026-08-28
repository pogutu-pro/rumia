import pytest
from httpx import AsyncClient
from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_track_view_public(client: AsyncClient):
    """Anyone can track a view."""
    payload = {"listing_id": "some-listing-id", "ip_hash": "abc123hashed"}
    response = await client.post("/api/v1/analytics/track-view", json=payload)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_view_counts_public(client: AsyncClient):
    response = await client.get("/api/v1/analytics/views/some-listing-id")
    assert response.status_code == 200
    data = response.json()
    assert "today_count" in data
    assert "all_time_count" in data


@pytest.mark.asyncio
async def test_get_platform_summary_admin(client: AsyncClient):
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id="admin-id-1", email="admin@rumia.app", role="admin"
    )
    try:
        response = await client.get("/api/v1/analytics/platform/summary")
        assert response.status_code == 200
        data = response.json()
        assert "today_count" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_platform_summary_non_admin_forbidden(client: AsyncClient):
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id="student-id-1", email="student@rumia.app", role="student"
    )
    try:
        response = await client.get("/api/v1/analytics/platform/summary")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
