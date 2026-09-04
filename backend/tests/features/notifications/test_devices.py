import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.core.security import AuthenticatedUser, get_current_user
from app.features.notifications.schemas import DeviceTokenActionResponse
from app.features.notifications.service import NotificationService
from app.main import app


@pytest.mark.asyncio
async def test_register_device_token_unauthorized(client: AsyncClient):
    payload = {"token": "test-device-token-123", "platform": "android"}
    response = await client.post("/api/v1/notifications/devices", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_register_device_token_success(client: AsyncClient):
    user = AuthenticatedUser(id="user-1", email="user@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        mock_res = DeviceTokenActionResponse(
            message="Device token registered successfully",
            token="test-device-token-123",
            is_active=True,
        )
        with patch.object(NotificationService, "register_device_token", new=AsyncMock(return_value=mock_res)):
            payload = {"token": "test-device-token-123", "platform": "android"}
            response = await client.post("/api/v1/notifications/devices", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["token"] == "test-device-token-123"
            assert data["is_active"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_unregister_device_token_success(client: AsyncClient):
    user = AuthenticatedUser(id="user-1", email="user@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        mock_res = DeviceTokenActionResponse(
            message="Device token unregistered successfully",
            token="test-device-token-123",
            is_active=False,
        )
        with patch.object(NotificationService, "unregister_device_token", new=AsyncMock(return_value=mock_res)):
            response = await client.delete("/api/v1/notifications/devices/test-device-token-123")
            assert response.status_code == 200
            data = response.json()
            assert data["is_active"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)
