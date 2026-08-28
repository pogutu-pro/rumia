import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_get_profile_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/profiles/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_profile_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/profiles/me")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "student-1"
        assert data["role"] == "student"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_set_home_campus_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        payload = {"campus_id": "dekut-id-1", "campus_name": "DeKUT Main Campus"}
        response = await client.post("/api/v1/profiles/me/campus", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["home_campus_id"] == "dekut-id-1"
        assert data["home_campus_name"] == "DeKUT Main Campus"
        assert data["home_campus_confirmed"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)
