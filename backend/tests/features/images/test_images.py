import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_get_upload_url_unauthorized(client: AsyncClient):
    payload = {
        "filename": "room-photo.jpg",
        "content_type": "image/jpeg",
        "size_bytes": 1024500,
    }
    response = await client.post("/api/v1/images/upload-url", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_upload_url_success(client: AsyncClient):
    user = AuthenticatedUser(id="agent-1", email="agent@rumia.app", role="agent")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        payload = {
            "filename": "room-photo.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 1024500,
        }
        response = await client.post("/api/v1/images/upload-url", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "upload_url" in data
        assert "key" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)
