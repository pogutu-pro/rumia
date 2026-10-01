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


def _fake_review(status: str = "published", user_id: str = "author-1", likes=()):
    from datetime import datetime, timezone
    from unittest.mock import MagicMock

    review = MagicMock()
    now = datetime.now(timezone.utc)
    for key, value in dict(
        id="r1", listing_id="l1", user_id=user_id, rating=5, text="Great place, loved it",
        stay_start=None, stay_end=None, school_verified_at_review_time=False, status=status,
        author_name="A", author_avatar_url=None, created_at=now, updated_at=now,
        rating_cleanliness=None, rating_security=None, rating_water=None, rating_wifi=None,
        rating_facilities=None, rating_location=None, rating_management=None, rating_value=None,
        replies=[], likes=list(likes),
    ).items():
        setattr(review, key, value)
    return review


@pytest.mark.asyncio
async def test_list_reviews_non_published_status_forbidden_for_anonymous(client: AsyncClient):
    response = await client.get("/api/v1/reviews?status=hidden")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_reviews_non_published_status_allowed_for_manager(client: AsyncClient):
    from app.core.security import get_optional_current_user

    app.dependency_overrides[get_optional_current_user] = lambda: AuthenticatedUser(
        id="m1", email="m@rumia.app", role="manager"
    )
    try:
        response = await client.get("/api/v1/reviews?status=hidden")
        assert response.status_code == 200
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


@pytest.mark.asyncio
async def test_get_unpublished_review_hidden_from_public_but_visible_to_author(client: AsyncClient):
    from unittest.mock import AsyncMock, patch

    from app.core.security import get_optional_current_user

    hidden = _fake_review(status="hidden", user_id="author-1")
    with patch("app.features.reviews.service.ReviewService.get_review_by_id", new_callable=AsyncMock, return_value=hidden):
        assert (await client.get("/api/v1/reviews/r1")).status_code == 404

        app.dependency_overrides[get_optional_current_user] = lambda: AuthenticatedUser(
            id="author-1", email="a@rumia.app", role="student"
        )
        try:
            assert (await client.get("/api/v1/reviews/r1")).status_code == 200
        finally:
            app.dependency_overrides.pop(get_optional_current_user, None)


@pytest.mark.asyncio
async def test_list_reviews_marks_liked_by_me(client: AsyncClient):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch

    from app.core.security import get_optional_current_user

    review = _fake_review(likes=[SimpleNamespace(user_id="viewer-1"), SimpleNamespace(user_id="other")])
    app.dependency_overrides[get_optional_current_user] = lambda: AuthenticatedUser(
        id="viewer-1", email="v@rumia.app", role="student"
    )
    try:
        with patch("app.features.reviews.service.ReviewService.list_reviews", new_callable=AsyncMock, return_value=([review], 1)):
            response = await client.get("/api/v1/reviews?listing_id=l1")
        item = response.json()["items"][0]
        assert item["like_count"] == 2
        assert item["liked_by_me"] is True

        app.dependency_overrides[get_optional_current_user] = lambda: None
        with patch("app.features.reviews.service.ReviewService.list_reviews", new_callable=AsyncMock, return_value=([review], 1)):
            response = await client.get("/api/v1/reviews?listing_id=l1")
        assert response.json()["items"][0]["liked_by_me"] is False
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)
