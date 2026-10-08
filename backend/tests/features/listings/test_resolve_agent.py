"""resolve_agent_for_user: staff get their own agent record, never someone else's or a placeholder phone."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.errors import BadRequestException, ForbiddenException
from app.core.security import AuthenticatedUser
from app.features.listings.service import ListingService
from tests.conftest import MockResult


def _db(*results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


def _staff(role="admin", managed_campus_id=None):
    return AuthenticatedUser(id="user-1", email="jane@example.com", role=role, managed_campus_id=managed_campus_id)


@pytest.mark.asyncio
async def test_returns_existing_agent():
    existing = SimpleNamespace(id="agent-1")
    db = _db(MockResult(single=existing))
    assert await ListingService.resolve_agent_for_user(db, _staff()) is existing
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_admin_without_agent_is_not_attributed_to_another_agent():
    profile = SimpleNamespace(full_name="Jane Admin", phone="+254712345678", campus_id="campus-1")
    db = _db(MockResult(single=None), MockResult(single=profile))
    agent = await ListingService.resolve_agent_for_user(db, _staff())
    assert agent.user_id == "user-1"
    assert agent.phone == "+254712345678"
    assert agent.whatsapp == "+254712345678"
    assert agent.name == "Jane Admin"
    db.add.assert_called_once()
    # Only the agent lookup and the profile lookup ran; no "pick any agent" query.
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_staff_without_phone_gets_a_clear_error_not_a_placeholder():
    profile = SimpleNamespace(full_name="Jane", phone=None, campus_id="campus-1")
    db = _db(MockResult(single=None), MockResult(single=profile))
    with pytest.raises(BadRequestException):
        await ListingService.resolve_agent_for_user(db, _staff(role="manager"))
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_staff_without_campus_gets_a_clear_error():
    profile = SimpleNamespace(full_name="Jane", phone="+254712345678", campus_id=None)
    db = _db(MockResult(single=None), MockResult(single=profile))
    with pytest.raises(BadRequestException):
        await ListingService.resolve_agent_for_user(db, _staff())
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_non_staff_without_agent_is_forbidden():
    db = _db(MockResult(single=None))
    with pytest.raises(ForbiddenException):
        await ListingService.resolve_agent_for_user(db, _staff(role="student"))
