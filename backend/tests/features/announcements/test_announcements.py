import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_list_announcements_public(client: AsyncClient):
    response = await client.get("/api/v1/announcements")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_create_announcement_unauthorized(client: AsyncClient):
    payload = {
        "campus_id": "dekut-id-1",
        "title": "Maintenance Notice",
        "message": "Water maintenance scheduled for Gate A hostels",
        "expires_at": "2026-12-31T23:59:59Z",
    }
    response = await client.post("/api/v1/announcements", json=payload)
    assert response.status_code == 401
