import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_subscribe_push_unauthorized(client: AsyncClient):
    payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/sample-endpoint",
        "p256dh": "key-p256dh",
        "auth": "key-auth",
    }
    response = await client.post("/api/v1/notifications/push/subscribe", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_subscribe_push_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        payload = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/sample-endpoint",
            "p256dh": "key-p256dh",
            "auth": "key-auth",
        }
        response = await client.post("/api/v1/notifications/push/subscribe", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_list_notifications_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/notifications")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
