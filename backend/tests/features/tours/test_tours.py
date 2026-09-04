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
