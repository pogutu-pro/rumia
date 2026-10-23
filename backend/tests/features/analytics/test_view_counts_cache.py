import uuid

import pytest
from fastapi import Response

import app.features.analytics.router as router_mod
from app.core.errors import BadRequestException
from app.features.analytics.schemas import ViewCountRead


@pytest.fixture
def counted(monkeypatch):
    calls = []

    async def fake_counts(db, listing_id):
        calls.append(listing_id)
        return ViewCountRead(listing_id=listing_id, today_count=len(calls), week_count=5, month_count=9, all_time_count=20)

    monkeypatch.setattr(router_mod.AnalyticsService, "get_listing_view_counts", staticmethod(fake_counts))
    monkeypatch.setattr(router_mod, "_view_counts_cache", {})
    return calls


@pytest.mark.asyncio
async def test_repeat_reads_within_a_minute_hit_the_database_once(counted, monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(router_mod.time, "monotonic", lambda: clock[0])
    listing = str(uuid.uuid4())

    first = await router_mod.get_view_counts(listing, Response(), db=None)
    second = await router_mod.get_view_counts(listing, Response(), db=None)
    assert counted == [listing] and first == second

    clock[0] += router_mod.VIEW_COUNTS_TTL_SECONDS + 1
    third = await router_mod.get_view_counts(listing, Response(), db=None)
    assert len(counted) == 2 and third.today_count == 2


@pytest.mark.asyncio
async def test_listings_are_cached_separately_and_marked_cacheable(counted):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    response = Response()
    await router_mod.get_view_counts(a, response, db=None)
    await router_mod.get_view_counts(b, Response(), db=None)
    assert counted == [a, b]
    assert response.headers["Cache-Control"] == f"public, max-age={router_mod.VIEW_COUNTS_TTL_SECONDS}"


@pytest.mark.asyncio
async def test_bad_ids_never_reach_the_database(counted):
    with pytest.raises(BadRequestException):
        await router_mod.get_view_counts("not-a-uuid", Response(), db=None)
    assert counted == []

