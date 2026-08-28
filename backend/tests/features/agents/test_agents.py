import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_list_agents(client: AsyncClient):
    response = await client.get("/api/v1/agents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_agent_not_found(client: AsyncClient):
    response = await client.get("/api/v1/agents/non-existent-agent-123")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_submit_application_unauthorized(client: AsyncClient):
    payload = {
        "campus_id": "dekut-id-1",
        "full_name": "John Doe",
        "phone": "+254712345678",
        "id_number": "12345678",
        "hostel_name": "Sunrise Heights",
        "relationship_to_hostel": "Caretaker",
    }
    response = await client.post("/api/v1/agents/apply", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_submit_application_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        payload = {
            "campus_id": "dekut-id-1",
            "full_name": "John Doe",
            "phone": "+254712345678",
            "id_number": "12345678",
            "hostel_name": "Sunrise Heights",
            "relationship_to_hostel": "Caretaker",
        }
        response = await client.post("/api/v1/agents/apply", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["full_name"] == "John Doe"
        assert data["status"] == "pending"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_review_application_non_admin_forbidden(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.patch(
            "/api/v1/agents/applications/app-123/review",
            json={"status": "approved"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
