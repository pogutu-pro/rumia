from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.routing import APIRoute
from httpx import AsyncClient

from app.core.errors import APIException
from app.core.security import AuthenticatedUser, get_current_user
from app.features.admin.console_router import router as console_router
from app.features.admin.console_schemas import AgentCreateRequest, AgentPatch, AgentSupportPatch
from app.features.admin.console_service import AdminConsoleService
from app.main import app
from tests.conftest import MockResult

ADMIN = SimpleNamespace(id="a1", role="admin", is_admin=True)
MANAGER = SimpleNamespace(id="m1", role="manager", is_admin=False)


def _db(*results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.flush = AsyncMock()
    db.add = MagicMock()
    db.delete = AsyncMock()
    return db


def test_every_console_route_is_admin_only():
    """Walk the router: each route must depend on require_roles('admin') (admins pass; others get 403)."""
    for route in console_router.routes:
        assert isinstance(route, APIRoute)
        deps = [d.call for d in route.dependant.dependencies]
        assert any(getattr(c, "__qualname__", "").startswith("require_roles") for c in deps), route.path


@pytest.mark.asyncio
async def test_console_endpoints_reject_anonymous_and_managers(client: AsyncClient):
    paths = ["/admin/overview", "/admin/users", "/admin/agents", "/admin/listings", "/admin/leads",
             "/admin/commissions", "/admin/transfers", "/admin/analytics", "/admin/support-agents"]
    for path in paths:
        assert (await client.get(f"/api/v1{path}")).status_code == 401, path
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id="m1", email="m@r.app", role="manager")
    try:
        for path in paths:
            assert (await client.get(f"/api/v1{path}")).status_code == 403, path
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_service_methods_refuse_non_admins():
    for call in (
        AdminConsoleService.overview(_db(), MANAGER),
        AdminConsoleService.list_users(_db(), MANAGER),
        AdminConsoleService.change_role(_db(), MANAGER, "u", "agent"),
        AdminConsoleService.promote_to_admin(_db(), MANAGER, "u"),
        AdminConsoleService.reorder(_db(), MANAGER, [SimpleNamespace(id="x", sort_position=1)]),
        AdminConsoleService.verify_all(_db(), MANAGER),
    ):
        with pytest.raises(APIException) as exc:
            await call
        assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_promote_to_admin_rules():
    with pytest.raises(APIException) as exc:
        await AdminConsoleService.promote_to_admin(_db(), ADMIN, "a1")
    assert exc.value.status_code == 400
    already = SimpleNamespace(role="admin")
    with pytest.raises(APIException) as exc:
        await AdminConsoleService.promote_to_admin(_db(MockResult(single=already)), ADMIN, "u2")
    assert exc.value.status_code == 409
    manager = SimpleNamespace(role="manager", managed_campus_id="c1", managed_region_id=None)
    await AdminConsoleService.promote_to_admin(_db(MockResult(single=manager)), ADMIN, "u2")
    assert manager.role == "admin" and manager.managed_campus_id is None   # admins are global


@pytest.mark.asyncio
async def test_create_agent_rolls_the_login_back_when_the_agent_record_fails(monkeypatch):
    provider = SimpleNamespace(create_user=AsyncMock(return_value="new-user"), delete_user=AsyncMock())
    monkeypatch.setattr("app.features.admin.console_service.get_auth_provider", lambda: provider)
    # no profile campus and no DeKUT campus -> cannot create the agent
    no_profile = MagicMock()
    no_profile.first.return_value = None
    db = _db(no_profile, MockResult(single=None))
    with pytest.raises(APIException):
        await AdminConsoleService.create_agent(db, ADMIN, AgentCreateRequest(name="New Agent", phone="0700123456", whatsapp="0700123456"))
    provider.create_user.assert_awaited_once_with("0700123456@agents.rumia.co.ke")
    provider.delete_user.assert_awaited_once_with("new-user")


@pytest.mark.asyncio
async def test_create_agent_success_notifies_admins(monkeypatch):
    provider = SimpleNamespace(create_user=AsyncMock(return_value="new-user"), delete_user=AsyncMock())
    monkeypatch.setattr("app.features.admin.console_service.get_auth_provider", lambda: provider)

    class Rows:
        def __init__(self, rows):
            self._rows = rows

        def scalars(self):
            return SimpleNamespace(all=lambda: self._rows)

    campus_row = MagicMock()
    campus_row.first.return_value = SimpleNamespace(campus_id="c1", home_campus_id=None)
    db = _db(campus_row, MockResult(single=None), Rows(["admin-1", "admin-2"]))
    agent, pushes = await AdminConsoleService.create_agent(
        db, ADMIN, AgentCreateRequest(name="New Agent", phone="0700123456", whatsapp="0700123456"))
    assert agent.slug == "new-agent" and agent.phone == "+254700123456" and agent.campus_id == "c1"
    assert [p.user_id for p in pushes] == ["admin-1", "admin-2"]
    provider.delete_user.assert_not_awaited()


@pytest.mark.asyncio
async def test_agent_edit_requires_a_field_and_support_owner_is_unique():
    agent = SimpleNamespace(id="a", name="N", phone="p", whatsapp="w", is_owner=False, is_support=False, support_rank=0)
    with pytest.raises(APIException):
        await AdminConsoleService.patch_agent(_db(MockResult(single=agent)), ADMIN, "a", AgentPatch())
    db = _db(MockResult(single=agent), MockResult())   # the lookup, then the "clear previous owner" UPDATE
    await AdminConsoleService.set_support(db, ADMIN, "a", AgentSupportPatch(is_owner=True, is_support=True, support_rank=2))
    assert db.execute.await_count == 2
    assert agent.is_owner and agent.is_support and agent.support_rank == 2


@pytest.mark.asyncio
async def test_single_listing_verify_never_overwrites_existing_decisions():
    listing = SimpleNamespace(
        id="l1", title="Totally Unknown Hostel", landlord_phone=None, agent=None, verified=True,
        verified_source="Admin Manual Verification", verified_date="keep", discrepancy_review_needed=False,
        shared_contact_detected=False, manual_review_needed=False,
    )
    out = await AdminConsoleService.verify_listing(_db(MockResult(single=listing)), ADMIN, "l1")
    assert out.verified is False                       # no official match…
    assert listing.verified is True                    # …but the manual verification is untouched
    assert listing.verified_source == "Admin Manual Verification" and listing.verified_date == "keep"


@pytest.mark.asyncio
async def test_commission_moves_the_agents_balance():
    agent = SimpleNamespace(id="a1")
    listing = SimpleNamespace(id="l1")
    db = _db(MockResult(single=agent), MockResult(single=listing), MockResult())
    commission = await AdminConsoleService.create_commission(db, ADMIN, SimpleNamespace(agent_id="a1", listing_id="l1", amount=500))
    assert commission.status == "pending" and commission.amount == 500
    assert db.execute.await_count == 3     # agent lookup, listing lookup, balance UPDATE
