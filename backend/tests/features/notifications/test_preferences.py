import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.security import AuthenticatedUser, get_current_user
from app.features.notifications.models import NotificationPreference
from app.features.notifications.schemas import NotificationPreferenceActionResponse
from app.features.notifications.service import NotificationService
from app.main import app


@pytest.mark.asyncio
async def test_unread_count_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/notifications/unread-count")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unread_count_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        with patch.object(NotificationService, "unread_count", new=AsyncMock(return_value=3)):
            response = await client.get("/api/v1/notifications/unread-count")
            assert response.status_code == 200
            assert response.json() == {"count": 3}
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_preferences_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/notifications/preferences")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_preferences_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        pref = MagicMock(spec=NotificationPreference)
        pref.wishlist_push_enabled = True
        pref.wishlist_email_enabled = False
        pref.updated_at = None
        with patch.object(NotificationService, "list_preferences", new=AsyncMock(return_value=pref)):
            response = await client.get("/api/v1/notifications/preferences")
            assert response.status_code == 200
            data = response.json()
            assert data["wishlist_push_enabled"] is True
            assert data["wishlist_email_enabled"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_update_preferences_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        mock_res = NotificationPreferenceActionResponse(
            message="Notification preferences updated successfully",
            wishlist_push_enabled=True,
            wishlist_email_enabled=False,
        )
        with patch.object(NotificationService, "update_preferences", new=AsyncMock(return_value=mock_res)):
            response = await client.patch(
                "/api/v1/notifications/preferences",
                json={"wishlist_email_enabled": False},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["wishlist_push_enabled"] is True
            assert data["wishlist_email_enabled"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_mark_all_read_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.patch("/api/v1/notifications/read-all")
        assert response.status_code == 200
        assert response.json()["message"] == "All notifications marked as read"
    finally:
        app.dependency_overrides.pop(get_current_user, None)