import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_get_profile_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/profiles/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_profile_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/profiles/me")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "student-1"
        assert data["role"] == "student"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_set_home_campus_success(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        payload = {
            "campus_id": "8f853c92-36bf-455d-b21f-14471ec16311",
            "campus_name": "DeKUT Main Campus",
        }
        response = await client.post("/api/v1/profiles/me/campus", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["home_campus_id"] == "8f853c92-36bf-455d-b21f-14471ec16311"
        assert data["home_campus_name"] == "DeKUT Main Campus"
        assert data["home_campus_confirmed"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_set_home_campus_rejects_invalid_uuid(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        # An empty/non-UUID campus_id must be a clean 422, not a 500 from a
        # Postgres UUID conversion failure.
        response = await client.post(
            "/api/v1/profiles/me/campus",
            json={"campus_id": "", "campus_name": "DeKUT Main Campus"},
        )
        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_profile_includes_agent_id_for_agent_owner(client: AsyncClient):
    from unittest.mock import AsyncMock, patch

    user = AuthenticatedUser(id="agent-user-1", email="a@rumia.app", role="agent")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        with patch(
            "app.features.profiles.service.ProfileService.get_agent_id",
            new_callable=AsyncMock,
            return_value="agent-record-1",
        ):
            response = await client.get("/api/v1/profiles/me")
        assert response.status_code == 200
        assert response.json()["agent_id"] == "agent-record-1"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_get_profile_agent_id_is_null_for_non_agent(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/profiles/me")
        assert response.status_code == 200
        assert response.json()["agent_id"] is None
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_check_email_reports_existence(client: AsyncClient):
    from unittest.mock import AsyncMock, patch

    with patch("app.features.profiles.service.ProfileService.email_exists", new_callable=AsyncMock, return_value=True) as exists:
        response = await client.get("/api/v1/profiles/check-email?email=Student@Example.com")
    assert response.status_code == 200
    assert response.json() == {"exists": True}
    assert exists.await_args.args[1] == "Student@Example.com"


@pytest.mark.asyncio
async def test_check_email_rejects_malformed_address(client: AsyncClient):
    response = await client.get("/api/v1/profiles/check-email?email=not-an-email")
    assert response.status_code == 422


# ── Post-login sync (replaces the OAuth callback's direct DB writes) ─────────────

from types import SimpleNamespace  # noqa: E402
from unittest.mock import AsyncMock, MagicMock  # noqa: E402

from app.features.profiles.service import ProfileService  # noqa: E402


def _profile(**kw):
    base = dict(id="u1", role="student", phone=None, home_campus_confirmed_at=None, home_campus_id=None,
                campus_id="c1", email=None, school_verified=False, school_email=None, full_name=None,
                avatar_url=None, updated_at=None)
    base.update(kw)
    return SimpleNamespace(**base)


def _sync_db(*rows):
    db = MagicMock()
    db.flush = AsyncMock()
    results = []
    for row in rows:
        res = MagicMock()
        res.fetchall.return_value = row
        results.append(res)
    db.execute = AsyncMock(side_effect=results)
    return db


@pytest.mark.asyncio
@pytest.mark.parametrize("email,verified", [("Student@DKUT.ac.ke", True), ("someone@gmail.com", False)])
async def test_school_verification_comes_from_the_token_email(email, verified):
    from unittest.mock import patch

    prof = _profile()
    user = SimpleNamespace(id="u1", email=email)
    with patch.object(ProfileService, "get_or_create_profile", new=AsyncMock(return_value=prof)):
        out, linked = await ProfileService.sync_login(_sync_db(), user, "Real Name", "http://a/p.png")
    assert out.school_verified is verified
    assert out.school_email == (email.lower() if verified else None)
    assert out.email == email.lower() and out.full_name == "Real Name" and out.avatar_url == "http://a/p.png"
    assert out.home_campus_id == "c1" and linked == 0   # new users start with the default campus


@pytest.mark.asyncio
async def test_guest_tour_bookings_are_linked_by_trailing_phone_digits():
    from unittest.mock import patch

    prof = _profile(phone="+254 712 345 678")
    db = _sync_db([("b1",), ("b2",)], [])
    with patch.object(ProfileService, "get_or_create_profile", new=AsyncMock(return_value=prof)):
        _, linked = await ProfileService.sync_login(db, SimpleNamespace(id="u1", email="a@b.c"), None, None)
    assert linked == 2
    select_params = db.execute.await_args_list[0].args[1]
    assert select_params == {"digits": "712345678", "n": 9}


@pytest.mark.asyncio
async def test_sync_login_endpoint_reports_profile_completion(client: AsyncClient):
    from unittest.mock import patch

    user = AuthenticatedUser(id="u1", email="a@b.c", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        with patch.object(ProfileService, "sync_login", new=AsyncMock(return_value=(_profile(), 0))):
            response = await client.post("/api/v1/profiles/me/sync-login", json={"full_name": "A"})
        assert response.status_code == 200
        assert response.json() == {"role": "student", "needs_profile_completion": True, "linked_bookings": 0}

        done = _profile(phone="0712345678", home_campus_confirmed_at="2026-01-01T00:00:00Z")
        with patch.object(ProfileService, "sync_login", new=AsyncMock(return_value=(done, 1))):
            response = await client.post("/api/v1/profiles/me/sync-login", json={})
        assert response.json()["needs_profile_completion"] is False

        staff = _profile(role="agent")  # staff are exempt from completion
        with patch.object(ProfileService, "sync_login", new=AsyncMock(return_value=(staff, 0))):
            response = await client.post("/api/v1/profiles/me/sync-login", json={})
        assert response.json()["needs_profile_completion"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_sync_login_requires_authentication(client: AsyncClient):
    assert (await client.post("/api/v1/profiles/me/sync-login", json={})).status_code == 401


def _profile_stub(**kw):
    from types import SimpleNamespace

    base = dict(
        id="student-1", full_name=None, phone=None, avatar_url=None, home_campus_id="default-dekut-id",
        home_campus_name=None, home_campus_confirmed_at=None, updated_at=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "campus_row, expected_id",
    [(None, None), (type("C", (), {"id": "moi-id"})(), "moi-id")],
    ids=["unregistered-campus-clears-default", "registered-campus-links-it"],
)
async def test_update_profile_campus_input_resolution(campus_row, expected_id):
    from unittest.mock import AsyncMock, MagicMock, patch

    from app.features.profiles.schemas import ProfileUpdate
    from app.features.profiles.service import ProfileService

    profile = _profile_stub()
    result = MagicMock()
    result.scalar_one_or_none.return_value = campus_row
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    db.flush = AsyncMock()
    user = AuthenticatedUser(id="student-1", email="s@gmail.com", role="student")

    with patch.object(ProfileService, "get_or_create_profile", AsyncMock(return_value=profile)):
        await ProfileService.update_profile(
            db, user, ProfileUpdate(phone="0712345678", campus_input="Moi University", home_campus_confirmed=True)
        )

    assert profile.home_campus_id == expected_id
    assert profile.home_campus_name == "Moi University"
    assert profile.home_campus_confirmed_at is not None
