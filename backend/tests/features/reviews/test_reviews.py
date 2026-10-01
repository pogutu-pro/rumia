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


# ── Service rules (ported from the former web actions) ───────────────────────────

from types import SimpleNamespace  # noqa: E402
from unittest.mock import AsyncMock, MagicMock  # noqa: E402

from app.core.errors import APIException  # noqa: E402
from app.features.reviews.models import ReviewModerationLog  # noqa: E402
from app.features.reviews.schemas import ReviewCreate, ReviewModerationAction, ReviewUpdate  # noqa: E402
from app.features.reviews.service import ReviewService  # noqa: E402
from tests.conftest import MockResult  # noqa: E402

STUDENT = SimpleNamespace(id="student-1", email="s@r.app", role="student", is_admin=False,
                          managed_campus_id=None, managed_region_id=None)


def _db(*results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    return db


def _profile(verified=True):
    return SimpleNamespace(id="student-1", full_name="Real Name", avatar_url="http://a/p.png", school_verified=verified)


@pytest.mark.asyncio
async def test_unverified_student_cannot_write_text_but_can_rate():
    data = ReviewCreate(listing_id="l1", rating=4, text="Nice place overall")
    with pytest.raises(APIException) as exc:
        await ReviewService.create_review(_db(MockResult(single=_profile(False))), STUDENT, data)
    assert exc.value.status_code == 403

    db = _db(MockResult(single=_profile(False)), MockResult(single=None))
    review = await ReviewService.create_review(db, STUDENT, ReviewCreate(listing_id="l1", rating=4))
    assert review.text is None and review.school_verified_at_review_time is False


@pytest.mark.asyncio
async def test_identity_and_verification_come_from_profile_not_request():
    db = _db(MockResult(single=_profile(True)), MockResult(single=None))
    review = await ReviewService.create_review(
        db, STUDENT, ReviewCreate(listing_id="l1", rating=5, text="  Great wifi and water  "),
    )
    assert review.text == "Great wifi and water"
    assert review.author_name == "Real Name" and review.author_avatar_url == "http://a/p.png"
    assert review.school_verified_at_review_time is True


@pytest.mark.asyncio
async def test_second_review_for_same_listing_conflicts():
    db = _db(MockResult(single=_profile(True)), MockResult(single="existing-review"))
    with pytest.raises(APIException) as exc:
        await ReviewService.create_review(db, STUDENT, ReviewCreate(listing_id="l1", rating=5))
    assert exc.value.status_code == 409 and exc.value.detail["code"] == "ALREADY_REVIEWED"


def _review(user_id="student-1", text="old text", status="published"):
    return SimpleNamespace(id="r1", listing_id="l1", user_id=user_id, text=text, status=status, rating=4,
                           updated_at=None, rating_cleanliness=3, rating_security=3, rating_water=3,
                           rating_wifi=3, rating_facilities=3, rating_location=3, rating_management=3, rating_value=3)


@pytest.mark.asyncio
async def test_only_the_author_can_edit_and_null_text_clears_it():
    review = await ReviewService.update_review(
        _db(MockResult(single=_review())), STUDENT, "r1", ReviewUpdate.model_validate({"text": None, "rating": 2}))
    assert review.text is None and review.rating == 2

    with pytest.raises(APIException) as exc:
        await ReviewService.update_review(_db(MockResult(single=_review(user_id="other"))), STUDENT, "r1", ReviewUpdate(rating=1))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_adding_text_to_a_textless_review_needs_verification():
    db = _db(MockResult(single=_review(text=None)), MockResult(single=_profile(False)))
    with pytest.raises(APIException) as exc:
        await ReviewService.update_review(db, STUDENT, "r1", ReviewUpdate(text="now with text"))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_manager_deletes_in_scope_with_audit_but_not_out_of_scope(monkeypatch):
    manager = SimpleNamespace(id="mgr-1", role="manager", is_admin=False, managed_campus_id="c1", managed_region_id=None)

    async def scope(user, campus_id, db):
        return campus_id == "c1"

    monkeypatch.setattr("app.features.reviews.service.check_campus_scope", scope)

    db = _db(MockResult(single=_review(user_id="other")), MockResult(single="c1"))
    await ReviewService.delete_review(db, manager, "r1")
    logs = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], ReviewModerationLog)]
    assert logs and logs[0].action == "delete" and logs[0].previous_text == "old text"
    db.delete.assert_awaited_once()

    with pytest.raises(APIException) as exc:
        await ReviewService.delete_review(_db(MockResult(single=_review(user_id="other")), MockResult(single="c2")), manager, "r1")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_moderation_logs_status_and_text_changes_and_rejects_noops():
    admin = SimpleNamespace(id="admin-1", role="admin", is_admin=True)
    db = _db(MockResult(single=_review()))
    db.add = MagicMock()
    review = await ReviewService.moderate_review(
        db, admin, "r1", ReviewModerationAction(action="hide", note="spam", text="edited"))
    assert review.status == "hidden" and review.text == "edited"
    kinds = [c.args[0].action for c in db.add.call_args_list]
    assert kinds == ["status_change", "text_edit"]

    with pytest.raises(APIException) as exc:
        await ReviewService.moderate_review(_db(MockResult(single=_review())), admin, "r1", ReviewModerationAction(action="approve"))
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_legacy_placeholder_text_counts_as_no_text():
    # Older mobile builds send this string for ratings-only reviews; an unverified student must still succeed.
    db = _db(MockResult(single=_profile(False)), MockResult(single=None))
    review = await ReviewService.create_review(
        db, STUDENT, ReviewCreate(listing_id="l1", rating=4, text="No written review provided."))
    assert review.text is None
