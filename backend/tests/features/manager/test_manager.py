from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.core.errors import APIException
from app.core.security import AuthenticatedUser, get_current_user
from app.features.manager.service import ManagerService
from app.features.zones.service import ZoneService
from app.main import app
from tests.conftest import MockResult


def _db(*results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.flush = AsyncMock()
    db.delete = AsyncMock()
    db.add = MagicMock()
    return db


MANAGER = SimpleNamespace(id="m1", role="manager", is_admin=False, managed_campus_id="c1", managed_region_id=None)
ADMIN = SimpleNamespace(id="a1", role="admin", is_admin=True, managed_campus_id=None, managed_region_id=None)


@pytest.fixture
def scope(monkeypatch):
    """Manager m1 covers campus c1 only."""
    async def check(user, campus_id, db):
        return user.is_admin or campus_id == "c1"

    monkeypatch.setattr("app.core.scope.check_campus_scope", check)
    return check


def _app(**kw):
    base = dict(id="app1", user_id="u9", campus_id="c1", full_name="Jane Doe", phone="0712345678",
                hostel_name="Sunrise", status="pending", reviewed_by=None, reviewed_at=None, rejection_reason=None)
    base.update(kw)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_approval_creates_agent_promotes_role_and_notifies(scope):
    profile = SimpleNamespace(role="student")
    db = _db(
        MockResult(single=_app()),   # application
        MockResult(single=None),     # no existing agent
        MockResult(single="x"),      # slug 'jane-doe' taken
        MockResult(single=None),     # 'jane-doe-2' free
        MockResult(single=profile),  # profile row
    )
    app_row, push = await ManagerService.approve_application(db, MANAGER, "app1")
    agent = db.add.call_args_list[0].args[0]
    assert agent.slug == "jane-doe-2" and agent.phone == "+254712345678" and agent.status == "active"
    assert profile.role == "agent"           # never anything higher
    assert app_row.status == "approved" and app_row.reviewed_by == "m1"
    assert push.user_id == "u9" and "approved" in push.title.lower()


@pytest.mark.asyncio
async def test_approval_rejected_when_processed_out_of_scope_or_already_agent(scope):
    with pytest.raises(APIException) as exc:
        await ManagerService.approve_application(_db(MockResult(single=_app(status="approved"))), MANAGER, "app1")
    assert exc.value.status_code == 409

    with pytest.raises(APIException) as exc:   # other campus
        await ManagerService.approve_application(_db(MockResult(single=_app(campus_id="c2"))), MANAGER, "app1")
    assert exc.value.status_code == 403

    with pytest.raises(APIException) as exc:
        await ManagerService.approve_application(
            _db(MockResult(single=_app()), MockResult(single="existing-agent")), MANAGER, "app1")
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_rejection_requires_a_reason_and_scope(scope):
    with pytest.raises(APIException) as exc:
        await ManagerService.reject_application(_db(), MANAGER, "app1", "   ")
    assert exc.value.status_code == 400
    row, push = await ManagerService.reject_application(_db(MockResult(single=_app())), MANAGER, "app1", "Incomplete docs")
    assert row.status == "rejected" and "Incomplete docs" in push.body


@pytest.mark.asyncio
async def test_agent_standing_needs_reason_scope_and_only_touches_status(scope):
    agent = SimpleNamespace(id="a1", user_id="u1", campus_id="c1", status="active", suspension_reason=None,
                            role="agent", verified=True)
    with pytest.raises(APIException):
        await ManagerService.set_agent_standing(_db(), MANAGER, "a1", "suspended", "  ")
    got, push = await ManagerService.set_agent_standing(_db(MockResult(single=agent)), MANAGER, "a1", "suspended", "Spam listings")
    assert got.status == "suspended" and got.suspension_reason == "Spam listings"
    assert got.verified is True and got.role == "agent"       # nothing else changes
    assert "suspended" in push.body.lower()
    back, _ = await ManagerService.set_agent_standing(_db(MockResult(single=agent)), MANAGER, "a1", "active", None)
    assert back.status == "active" and back.suspension_reason is None

    other = SimpleNamespace(id="a2", user_id="u2", campus_id="c2", status="active", suspension_reason=None)
    with pytest.raises(APIException) as exc:
        await ManagerService.set_agent_standing(_db(MockResult(single=other)), MANAGER, "a2", "suspended", "x")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_staff_operations_are_admin_only_and_scope_is_exclusive():
    for call in (
        ManagerService.list_staff(_db(), MANAGER),
        ManagerService.assign_manager(_db(), MANAGER, "u1", "c1", None),
        ManagerService.remove_manager(_db(), MANAGER, "u1"),
        ManagerService.find_user_by_email(_db(), MANAGER, "a@b.c"),
        ManagerService.search_agents_to_promote(_db(), MANAGER, "ab"),
    ):
        with pytest.raises(APIException) as exc:
            await call
        assert exc.value.status_code == 403

    with pytest.raises(APIException) as exc:
        await ManagerService.assign_manager(_db(), ADMIN, "u1", "c1", "r1")
    assert exc.value.status_code == 400
    with pytest.raises(APIException) as exc:      # cannot demote yourself
        await ManagerService.remove_manager(_db(), ADMIN, "a1")
    assert exc.value.status_code == 400

    prof = SimpleNamespace(id="u1", role="agent", managed_campus_id=None, managed_region_id=None)
    out = await ManagerService.assign_manager(_db(MockResult(single=prof)), ADMIN, "u1", "c1", None)
    assert out.role == "manager" and out.managed_campus_id == "c1"
    await ManagerService.remove_manager(_db(MockResult(single=prof)), ADMIN, "u1")
    assert prof.role == "agent" and prof.managed_campus_id is None


@pytest.mark.asyncio
async def test_campus_settings_need_a_zone_and_ignore_admin_fields_for_managers(scope):
    from app.features.manager.schemas import CampusSettingsUpdate

    campus = SimpleNamespace(id="c1", name="Old", phone=None, hostel_finding_fee=None, slug="old")
    data = CampusSettingsUpdate(phone="0700", name="Hacked", hostel_finding_fee=150)
    with pytest.raises(APIException) as exc:
        await ManagerService.update_campus_settings(_db(MockResult(single=campus), MockResult(scalar_value=0)), MANAGER, "c1", data)
    assert exc.value.status_code == 400 and "zone" in exc.value.detail["message"]

    out = await ManagerService.update_campus_settings(
        _db(MockResult(single=campus), MockResult(scalar_value=3)), MANAGER, "c1", data)
    assert out.phone == "0700" and out.hostel_finding_fee == 150 and out.name == "Old"   # name ignored for managers
    out = await ManagerService.update_campus_settings(
        _db(MockResult(single=campus), MockResult(scalar_value=3)), ADMIN, "c1", data)
    assert out.name == "Hacked"


@pytest.mark.asyncio
async def test_zone_delete_is_blocked_while_listings_use_it(scope):
    zone = SimpleNamespace(id="z1", campus_id="c1", name="Boma", slug="boma")
    with pytest.raises(APIException) as exc:
        await ZoneService.delete_zone(_db(MockResult(single=zone), MockResult(scalar_value=2)), MANAGER, "z1")
    assert exc.value.status_code == 400 and "2 hostel listings" in exc.value.detail["message"]
    db = _db(MockResult(single=zone), MockResult(scalar_value=0))
    await ZoneService.delete_zone(db, MANAGER, "z1")
    db.delete.assert_awaited_once()


@pytest.mark.asyncio
async def test_zone_slugs_stay_unique_within_a_campus(scope):
    class Rows:
        def scalars(self):
            return SimpleNamespace(all=lambda: ["boma", "boma-2"])

    data = SimpleNamespace(campus_id="c1", name="Boma", full_search_price=500, distance_category=None)
    zone = await ZoneService.create_zone(_db(Rows()), MANAGER, data)
    assert zone.slug == "boma-3"
    with pytest.raises(APIException):
        await ZoneService.create_zone(_db(), MANAGER, SimpleNamespace(campus_id="c2", name="X", full_search_price=1, distance_category=None))


@pytest.mark.asyncio
async def test_manager_endpoints_reject_students_and_anonymous(client: AsyncClient):
    assert (await client.get("/api/v1/manager/overview")).status_code == 401
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id="s1", email="s@r.app", role="student")
    try:
        for path in ("/manager/overview", "/manager/agents", "/manager/applications", "/manager/staff"):
            assert (await client.get(f"/api/v1{path}")).status_code == 403, path
    finally:
        app.dependency_overrides.pop(get_current_user, None)
