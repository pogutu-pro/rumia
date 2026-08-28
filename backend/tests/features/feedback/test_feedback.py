import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_submit_feedback_public(client: AsyncClient):
    payload = {
        "content": "This website is awesome! Very clean UI.",
        "user_email": "student@example.com",
    }
    response = await client.post("/api/v1/feedback", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == payload["content"]


@pytest.mark.asyncio
async def test_list_feedback_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/feedback")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_feedback_non_admin_forbidden(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/feedback")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
