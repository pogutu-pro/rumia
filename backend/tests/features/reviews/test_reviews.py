import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_list_reviews_public(client: AsyncClient):
    response = await client.get("/api/v1/reviews?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_get_review_not_found(client: AsyncClient):
    response = await client.get("/api/v1/reviews/non-existent-review-123")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_create_review_unauthorized(client: AsyncClient):
    payload = {
        "listing_id": "test-listing-1",
        "rating": 5,
        "text": "Great hostel with excellent wifi and water supply!",
    }
    response = await client.post("/api/v1/reviews", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_review_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        payload = {
            "listing_id": "test-listing-1",
            "rating": 5,
            "text": "Great hostel with excellent wifi and water supply!",
            "rating_cleanliness": 5,
            "rating_security": 4,
        }
        response = await client.post("/api/v1/reviews", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["rating"] == 5
        assert data["text"] == "Great hostel with excellent wifi and water supply!"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_moderate_review_non_admin_forbidden(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.patch(
            "/api/v1/reviews/review-123/moderate",
            json={"action": "hide", "note": "Spam content"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
