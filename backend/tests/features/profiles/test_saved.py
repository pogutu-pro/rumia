import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.core.security import AuthenticatedUser, get_current_user
from app.features.profiles.schemas import SavedHostelActionResponse
from app.features.profiles.service import ProfileService
from app.main import app


@pytest.mark.asyncio
async def test_get_saved_hostels_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/profiles/me/saved")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_saved_hostels_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/profiles/me/saved")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_save_hostel_endpoint(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        mock_response = SavedHostelActionResponse(
            message="Hostel saved successfully",
            is_saved=True,
            listing_id="listing-123",
        )
        with patch.object(ProfileService, "save_hostel", new=AsyncMock(return_value=mock_response)):
            response = await client.post("/api/v1/profiles/me/saved/listing-123")
            assert response.status_code == 200
            data = response.json()
            assert data["is_saved"] is True
            assert data["listing_id"] == "listing-123"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_saved_state_endpoint(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        mock_response = SavedHostelActionResponse(
            message="Hostel saved",
            is_saved=True,
            listing_id="listing-123",
        )
        with patch.object(ProfileService, "get_saved_state", new=AsyncMock(return_value=mock_response)):
            response = await client.get("/api/v1/profiles/me/saved/listing-123")
            assert response.status_code == 200
            data = response.json()
            assert data["is_saved"] is True
            assert data["listing_id"] == "listing-123"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_saved_state_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/profiles/me/saved/listing-123")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unsave_hostel_endpoint(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        mock_response = SavedHostelActionResponse(
            message="Hostel unsaved successfully",
            is_saved=False,
            listing_id="listing-123",
        )
        with patch.object(ProfileService, "unsave_hostel", new=AsyncMock(return_value=mock_response)):
            response = await client.delete("/api/v1/profiles/me/saved/listing-123")
            assert response.status_code == 200
            data = response.json()
            assert data["is_saved"] is False
            assert data["listing_id"] == "listing-123"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
