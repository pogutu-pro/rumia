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
        payload = {
            "campus_id": "8f853c92-36bf-455d-b21f-14471ec16311",
            "campus_name": "DeKUT Main Campus",
        }
        response = await client.post("/api/v1/profiles/me/campus", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["home_campus_id"] == "8f853c92-36bf-455d-b21f-14471ec16311"
        assert data["home_campus_name"] == "DeKUT Main Campus"
        assert data["home_campus_confirmed"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_set_home_campus_rejects_invalid_uuid(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        # An empty/non-UUID campus_id must be a clean 422, not a 500 from a
        # Postgres UUID conversion failure.
        response = await client.post(
            "/api/v1/profiles/me/campus",
            json={"campus_id": "", "campus_name": "DeKUT Main Campus"},
        )
        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_profile_includes_agent_id_for_agent_owner(client: AsyncClient):
    from unittest.mock import AsyncMock, patch

    user = AuthenticatedUser(id="agent-user-1", email="a@rumia.app", role="agent")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        with patch(
            "app.features.profiles.service.ProfileService.get_agent_id",
            new_callable=AsyncMock,
            return_value="agent-record-1",
        ):
            response = await client.get("/api/v1/profiles/me")
        assert response.status_code == 200
        assert response.json()["agent_id"] == "agent-record-1"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_profile_agent_id_is_null_for_non_agent(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/profiles/me")
        assert response.status_code == 200
        assert response.json()["agent_id"] is None
    finally:
        app.dependency_overrides.pop(get_current_user, None)
