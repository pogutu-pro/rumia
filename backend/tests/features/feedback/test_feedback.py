import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


def _student() -> AuthenticatedUser:
    return AuthenticatedUser(id="8f853c92-36bf-455d-b21f-14471ec16311", email="student@rumia.app", role="student")


@pytest.mark.asyncio
async def test_submit_feedback_requires_login(client: AsyncClient):
    response = await client.post("/api/v1/feedback", json={"category": "general", "message": "Great site!"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_submit_feedback_success(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _student
    try:
        response = await client.post(
            "/api/v1/feedback", json={"category": "report_problem", "message": "The map does not load."}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "report_problem"
        assert data["message"] == "The map does not load."
        assert data["user_email"] == "student@rumia.app"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_submit_feedback_rejects_unknown_category(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _student
    try:
        response = await client.post("/api/v1/feedback", json={"category": "spam", "message": "hello there"})
        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_list_feedback_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/feedback")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_feedback_non_admin_forbidden(client: AsyncClient):
    app.dependency_overrides[get_current_user] = _student
    try:
        response = await client.get("/api/v1/feedback")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
