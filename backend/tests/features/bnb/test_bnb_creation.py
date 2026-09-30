from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.bnb.router import get_public_bnb_listings
from app.features.bnb.schemas import BnbListingCreate
from app.features.bnb.service import BnbService
from app.features.listings.models import Listing
from app.features.listings.schemas import ListingCreate
from app.features.listings.service import ListingService
from tests.conftest import MockResult, _make_mock_listing


async def _create_bnb(active: bool, monkeypatch) -> Listing:
    db = MagicMock()
    db.add = MagicMock()
    db.execute = AsyncMock(return_value=MockResult())
    db.flush = AsyncMock()

    agent = SimpleNamespace(
        id="00000000-0000-0000-0000-000000000010",
        campus_id=None,
        whatsapp="+254700000000",
    )
    user = AuthenticatedUser(id="00000000-0000-0000-0000-000000000011", role="agent")
    monkeypatch.setattr(ListingService, "resolve_agent_for_user", AsyncMock(return_value=agent))
    monkeypatch.setattr(ListingService, "_auto_verify_listing", AsyncMock())

    listing, _ = await BnbService.create_bnb_listing(
        db=db,
        user=user,
        data=BnbListingCreate(
            title="Quiet short stay",
            description="A comfortable short-stay property near town.",
            price=3500,
            location="Nyeri",
            is_active=active,
        ),
    )
    return listing


@pytest.mark.asyncio
async def test_create_bnb_draft_is_inactive(monkeypatch):
    listing = await _create_bnb(active=False, monkeypatch=monkeypatch)

    assert listing.property_type == "short_stay"
    assert listing.is_active is False


@pytest.mark.asyncio
async def test_create_bnb_published_listing_is_active(monkeypatch):
    listing = await _create_bnb(active=True, monkeypatch=monkeypatch)

    assert listing.property_type == "short_stay"
    assert listing.is_active is True


@pytest.mark.asyncio
async def test_regular_listing_creation_defaults_to_active(monkeypatch):
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    agent = SimpleNamespace(
        id="00000000-0000-0000-0000-000000000010",
        campus_id=None,
        whatsapp="+254700000000",
    )
    user = AuthenticatedUser(id="00000000-0000-0000-0000-000000000011", role="agent")
    monkeypatch.setattr(ListingService, "resolve_agent_for_user", AsyncMock(return_value=agent))
    monkeypatch.setattr(ListingService, "_auto_verify_listing", AsyncMock())

    data = ListingCreate(
        title="Standard hostel",
        description="A comfortable hostel listing near campus.",
        price=6500,
        location="Nyeri",
    )
    listing = await ListingService.create_listing(db=db, user=user, data=data)

    assert data.is_active is True
    assert listing.is_active is True


@pytest.mark.asyncio
async def test_public_bnb_feed_excludes_inactive_listings():
    db = MagicMock()
    inactive_listing = _make_mock_listing(is_active=False, property_type="short_stay")

    async def execute(stmt):
        sql = str(
            stmt.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        ).lower()
        includes_active_filter = "listings.is_active = true" in sql
        if "count(" in sql:
            return MockResult(scalar_value=0 if includes_active_filter else 1)
        if "from listings" in sql and "bnb_details" not in sql:
            return MockResult(items=[] if includes_active_filter else [inactive_listing])
        return MockResult()

    db.execute = AsyncMock(side_effect=execute)
    response = await get_public_bnb_listings(
        pagination=PaginationParams(page=1, limit=20),
        db=db,
    )

    feed_stmt = db.execute.await_args_list[1].args[0]
    feed_sql = str(
        feed_stmt.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    ).lower()

    assert "listings.is_active = true" in feed_sql
    assert response.items == []
