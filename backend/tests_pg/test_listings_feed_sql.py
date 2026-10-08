import pytest

from app.core.pagination import PaginationParams
from app.features.listings.service import ListingService
from tests_pg.conftest import make_agent, make_campus, make_listing


@pytest.mark.asyncio
async def test_feed_filters_and_pagination_run_against_real_sql(db):
    campus = await make_campus(db, "feed-campus")
    agent = await make_agent(db, campus)
    await make_listing(db, agent, campus, title="Cheap", price=4000)
    await make_listing(db, agent, campus, title="Mid", price=7000)
    await make_listing(db, agent, campus, title="Flat", price=20000, property_type="apartment")
    await make_listing(db, agent, campus, title="Hidden", price=5000, is_active=False)

    items, total, _ = await ListingService.get_listings_feed(
        db, PaginationParams(page=1, limit=10), campus_slug="feed-campus", max_price=8000
    )
    assert {i.title for i in items} == {"Cheap", "Mid"}
    assert total == 2

    apartments, total, _ = await ListingService.get_listings_feed(
        db, PaginationParams(page=1, limit=10), campus_slug="feed-campus", property_type="apartment"
    )
    assert [i.title for i in apartments] == ["Flat"] and total == 1

    page2, total, _ = await ListingService.get_listings_feed(
        db, PaginationParams(page=2, limit=1), campus_slug="feed-campus", sort="newest"
    )
    assert total == 3 and len(page2) == 1
