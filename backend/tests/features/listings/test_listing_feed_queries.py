from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.features.listings.service import ListingService
from tests.conftest import MockResult, _make_mock_listing


class RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class ListingsResult:
    def __init__(self, listings):
        self._listings = listings

    def scalars(self):
        return SimpleNamespace(all=lambda: self._listings)


@pytest.mark.asyncio
async def test_views_sort_reuses_all_time_counts_for_order_and_response():
    popular = _make_mock_listing(id="00000000-0000-0000-0000-000000000001")
    newest = _make_mock_listing(id="00000000-0000-0000-0000-000000000002")
    db = MagicMock()
    db.execute = AsyncMock(side_effect=[
        MockResult(scalar_value=2),
        RowsResult([(popular, 18), (newest, 7)]),
    ])

    listings, total, view_counts = await ListingService.get_listings_feed(
        db=db,
        pagination=SimpleNamespace(offset=0, limit=20),
        sort="views",
    )

    assert total == 2
    assert listings == [popular, newest]
    assert view_counts == {
        str(popular.id): 18,
        str(newest.id): 7,
    }
    assert db.execute.await_count == 2  # count plus listing query; no follow-up view query

    listing_stmt = db.execute.await_args_list[1].args[0]
    sql = str(listing_stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})).lower()
    assert "listing_view_daily_rollup" in sql
    assert "order by coalesce(anon_1.view_count, 0) desc" in sql
    assert "coalesce(anon_1.view_count, 0) as view_count" in sql


@pytest.mark.asyncio
async def test_normal_sort_preserves_curated_order_and_counts_rollup_views():
    listing = _make_mock_listing(id="00000000-0000-0000-0000-000000000003")
    db = MagicMock()
    db.execute = AsyncMock(side_effect=[
        MockResult(scalar_value=1),
        ListingsResult([listing]),
        RowsResult([(listing.id, 31)]),
    ])

    listings, total, view_counts = await ListingService.get_listings_feed(
        db=db,
        pagination=SimpleNamespace(offset=0, limit=20),
    )

    assert total == 1
    assert listings == [listing]
    assert view_counts == {str(listing.id): 31}
    assert db.execute.await_count == 3

    listing_sql = str(db.execute.await_args_list[1].args[0].compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})).lower()
    counts_sql = str(db.execute.await_args_list[2].args[0].compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})).lower()
    assert "order by listings.sort_position asc nulls last" in listing_sql
    assert "listing_view_daily_rollup" in counts_sql
    assert "listing_views.listing_id in" in counts_sql
