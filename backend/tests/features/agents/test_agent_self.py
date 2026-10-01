from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.core.errors import APIException
from app.core.security import AuthenticatedUser, get_current_user
from app.features.agents.service import DEFAULT_AGENT_PHONE, AgentService
from app.features.official_hostels.service import OfficialHostelService
from app.main import app
from tests.conftest import MockResult


def _db(*results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.flush = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_students_cannot_self_create_an_agent_record():
    student = SimpleNamespace(id="u1", role="student")
    with pytest.raises(APIException) as exc:
        await AgentService.ensure_agent(_db(MockResult(single=None)), student, None)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_manager_gets_an_agent_record_on_first_visit_using_profile_phone():
    manager = SimpleNamespace(id="u1", role="manager", managed_campus_id=None)
    phone_row = SimpleNamespace(phone="+254700111222", full_name="Mgr Name", campus_id="campus-9")
    phone_res = MagicMock()
    phone_res.first.return_value = phone_row
    db = _db(MockResult(single=None), phone_res)
    db.add = MagicMock()
    agent = await AgentService.ensure_agent(db, manager, None)
    assert agent.name == "Mgr Name" and agent.phone == "+254700111222" and agent.status == "active"
    assert agent.campus_id == "campus-9"   # agents.campus_id is NOT NULL


@pytest.mark.asyncio
async def test_manager_without_phone_falls_back_to_placeholder():
    manager = SimpleNamespace(id="u1", role="admin", managed_campus_id=None)
    phone_res = MagicMock()
    phone_res.first.return_value = None
    db = _db(MockResult(single=None), phone_res)
    db.add = MagicMock()
    agent = await AgentService.ensure_agent(db, manager, "Display")
    assert agent.phone == DEFAULT_AGENT_PHONE and agent.name == "Display"


@pytest.mark.asyncio
async def test_existing_agent_record_is_returned_unchanged():
    existing = SimpleNamespace(id="a1")
    got = await AgentService.ensure_agent(_db(MockResult(single=existing)), SimpleNamespace(id="u1", role="student"), None)
    assert got is existing


@pytest.mark.asyncio
async def test_agent_cannot_read_another_agents_analytics(client: AsyncClient):
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id="u1", email="a@r.app", role="agent")
    try:
        # the mocked DB finds no agent owned by this user for that id -> forbidden
        response = await client.get("/api/v1/analytics/agent/9a1b2c3d-36bf-455d-b21f-14471ec16312")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_official_records_need_an_agent_record_or_staff_role():
    with pytest.raises(APIException) as exc:
        await OfficialHostelService.assert_can_view(
            _db(MockResult(single=None)), SimpleNamespace(id="u1", is_manager=False))
    assert exc.value.status_code == 403
    await OfficialHostelService.assert_can_view(_db(), SimpleNamespace(id="u1", is_manager=True))
    await OfficialHostelService.assert_can_view(_db(MockResult(single="a1")), SimpleNamespace(id="u1", is_manager=False))
