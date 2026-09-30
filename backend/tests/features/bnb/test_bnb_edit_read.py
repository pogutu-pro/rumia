from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.core.errors import ForbiddenException, NotFoundException
from app.core.security import AuthenticatedUser
from app.features.bnb.models import BnbDetails
from app.features.bnb.router import get_bnb_listing
from app.features.bnb.service import BnbService
from app.features.listings.service import ListingService
from tests.conftest import MockResult, _make_mock_listing


async def _get_owned_listing_for_edit(*, active: bool, user: AuthenticatedUser, monkeypatch):
    listing = _make_mock_listing(
        id="00000000-0000-0000-0000-000000000030",
        agent_id="owner-agent-id",
        agent_user_id="owner-user-id",
        property_type="short_stay",
        is_active=active,
    )
    listing.agent_id = "owner-agent-id"
    details = BnbDetails(listing_id=listing.id)
    db = MagicMock()
    db.execute = AsyncMock(
        side_effect=[
            MockResult(single=SimpleNamespace(id="owner-agent-id")),
            MockResult(single=details),
        ]
    )
    monkeypatch.setattr(
        ListingService,
        "get_listing_by_id_or_slug",
        AsyncMock(return_value=listing),
    )

    result_listing, result_details = await BnbService.get_bnb_listing_for_edit(
        db=db,
        listing_id=listing.id,
        user=user,
    )
    return result_listing, result_details


@pytest.mark.asyncio
async def test_owner_can_load_active_bnb_for_edit(monkeypatch):
    user = AuthenticatedUser(id="owner-user-id", role="agent")

    listing, details = await _get_owned_listing_for_edit(
        active=True,
        user=user,
        monkeypatch=monkeypatch,
    )

    assert listing.is_active is True
    assert details.listing_id == listing.id


@pytest.mark.asyncio
async def test_owner_can_load_inactive_bnb_for_edit(monkeypatch):
    user = AuthenticatedUser(id="owner-user-id", role="agent")

    listing, details = await _get_owned_listing_for_edit(
        active=False,
        user=user,
        monkeypatch=monkeypatch,
    )

    assert listing.is_active is False
    assert details.listing_id == listing.id


@pytest.mark.asyncio
async def test_different_agent_cannot_load_inactive_bnb_for_edit(monkeypatch):
    listing = _make_mock_listing(
        id="00000000-0000-0000-0000-000000000030",
        agent_id="owner-agent-id",
        property_type="short_stay",
        is_active=False,
    )
    listing.agent_id = "owner-agent-id"
    db = MagicMock()
    db.execute = AsyncMock(
        return_value=MockResult(single=SimpleNamespace(id="different-agent-id"))
    )
    monkeypatch.setattr(
        ListingService,
        "get_listing_by_id_or_slug",
        AsyncMock(return_value=listing),
    )

    with pytest.raises(ForbiddenException):
        await BnbService.get_bnb_listing_for_edit(
            db=db,
            listing_id=listing.id,
            user=AuthenticatedUser(id="other-user-id", role="agent"),
        )

    assert db.execute.await_count == 1


@pytest.mark.asyncio
async def test_admin_can_load_inactive_bnb_for_edit(monkeypatch):
    listing = _make_mock_listing(
        id="00000000-0000-0000-0000-000000000030",
        agent_id="owner-agent-id",
        property_type="short_stay",
        is_active=False,
    )
    listing.agent_id = "owner-agent-id"
    details = BnbDetails(listing_id=listing.id)
    db = MagicMock()
    db.execute = AsyncMock(return_value=MockResult(single=details))
    monkeypatch.setattr(
        ListingService,
        "get_listing_by_id_or_slug",
        AsyncMock(return_value=listing),
    )

    result_listing, result_details = await BnbService.get_bnb_listing_for_edit(
        db=db,
        listing_id=listing.id,
        user=AuthenticatedUser(id="admin-user-id", role="admin"),
    )

    assert result_listing.is_active is False
    assert result_details is details
    db.execute.assert_awaited_once()  # Admin bypasses the agent lookup.


@pytest.mark.asyncio
async def test_public_bnb_detail_still_hides_inactive_listing(monkeypatch):
    listing = _make_mock_listing(
        id="00000000-0000-0000-0000-000000000030",
        property_type="short_stay",
        is_active=False,
    )
    monkeypatch.setattr(
        BnbService,
        "get_bnb_listing",
        AsyncMock(return_value=(listing, None)),
    )

    with pytest.raises(NotFoundException):
        await get_bnb_listing(listing_id=listing.id, user=None, db=MagicMock())


@pytest.mark.asyncio
async def test_edit_read_route_requires_authentication(client: AsyncClient):
    response = await client.get(
        "/api/v1/bnb/my/00000000-0000-0000-0000-000000000030"
    )

    assert response.status_code == 401
