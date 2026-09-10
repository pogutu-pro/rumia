import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.core.security import AuthenticatedUser, get_current_user
from app.features.profiles.schemas import WishlistActionResponse
from app.features.profiles.service import ProfileService
from app.main import app


@pytest.mark.asyncio
async def test_get_wishlist_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/profiles/me/wishlist")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_wishlist_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/profiles/me/wishlist")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_wishlist_hostel_endpoint(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        mock_response = WishlistActionResponse(
            message="Hostel saved successfully",
            is_saved=True,
            listing_id="listing-123",
        )
        with patch.object(ProfileService, "save_hostel", new=AsyncMock(return_value=mock_response)):
            response = await client.post("/api/v1/profiles/me/wishlist/listing-123")
            assert response.status_code == 200
            data = response.json()
            assert data["is_saved"] is True
            assert data["listing_id"] == "listing-123"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_wishlist_state_endpoint(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        mock_response = WishlistActionResponse(
            message="Hostel saved",
            is_saved=True,
            listing_id="listing-123",
        )
        with patch.object(ProfileService, "get_saved_state", new=AsyncMock(return_value=mock_response)):
            response = await client.get("/api/v1/profiles/me/wishlist/listing-123")
            assert response.status_code == 200
            data = response.json()
            assert data["is_saved"] is True
            assert data["listing_id"] == "listing-123"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_unwishlist_hostel_endpoint(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        mock_response = WishlistActionResponse(
            message="Hostel unsaved successfully",
            is_saved=False,
            listing_id="listing-123",
        )
        with patch.object(ProfileService, "unsave_hostel", new=AsyncMock(return_value=mock_response)):
            response = await client.delete("/api/v1/profiles/me/wishlist/listing-123")
            assert response.status_code == 200
            data = response.json()
            assert data["is_saved"] is False
            assert data["listing_id"] == "listing-123"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_saved_alias_still_works(client: AsyncClient):
    """Legacy /me/saved paths remain functional during the migration window."""
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
async def test_batch_check_wishlist_unauthorized(client: AsyncClient):
    response = await client.post(
        "/api/v1/profiles/me/wishlist/batch-check",
        json={"ids": ["listing-1", "listing-2"]},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_batch_check_wishlist_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        saved_set = {"listing-1", "listing-3"}
        with patch.object(
            ProfileService, "get_saved_listing_ids", new=AsyncMock(return_value=saved_set)
        ):
            response = await client.post(
                "/api/v1/profiles/me/wishlist/batch-check",
                json={"ids": ["listing-1", "listing-2", "listing-3"]},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["saved"]["listing-1"] is True
            assert data["saved"]["listing-2"] is False
            assert data["saved"]["listing-3"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_batch_check_wishlist_empty_ids(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        with patch.object(
            ProfileService, "get_saved_listing_ids", new=AsyncMock(return_value=set())
        ):
            response = await client.post(
                "/api/v1/profiles/me/wishlist/batch-check",
                json={"ids": []},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["saved"] == {}
    finally:
        app.dependency_overrides.pop(get_current_user, None)