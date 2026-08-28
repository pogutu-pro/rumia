import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_list_campuses_admin(client: AsyncClient):
    admin = AuthenticatedUser(id="admin-1", email="admin@rumia.app", role="admin")
    app.dependency_overrides[get_current_user] = lambda: admin
    try:
        response = await client.get("/api/v1/admin/campuses")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_create_campus_non_admin(client: AsyncClient):
    student = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: student
    try:
        payload = {
            "slug": "ku-main",
            "name": "Kenyatta University Main Campus",
            "city": "Nairobi",
            "hero_headline": "Find your home near KU",
            "whatsapp_number": "+254700000000",
        }
        response = await client.post("/api/v1/admin/campuses", json=payload)
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_platform_stats_admin(client: AsyncClient):
    admin = AuthenticatedUser(id="admin-1", email="admin@rumia.app", role="admin")
    app.dependency_overrides[get_current_user] = lambda: admin
    try:
        response = await client.get("/api/v1/admin/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_listings" in data
        assert "active_listings" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)
