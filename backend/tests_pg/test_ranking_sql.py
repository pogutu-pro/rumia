from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from app.features.listings.ranking import EXPLORE_EVERY, EXPLORE_START, TOP_BAND, auto_rank
from tests_pg.conftest import make_agent, make_campus, make_listing, make_user

NOON = datetime(2026, 10, 23, 10, 0, tzinfo=timezone.utc)  # 13:00 Nairobi, the pm slot


async def setup(db, n=8):
    campus = await make_campus(db)
    agent = await make_agent(db, campus)
    ids = [await make_listing(db, agent, campus, sort_position=i + 1) for i in range(n)]
    # The last listing is clearly the most visited this week.
    for _ in range(25):
        await db.execute(text("INSERT INTO listing_views (listing_id, ip_hash) VALUES (CAST(:l AS uuid), md5(random()::text))"), {"l": ids[-1]})
    return ids


async def positions(db, ids):
    rows = await db.execute(text("SELECT id::text, sort_position FROM listings WHERE id = ANY(CAST(:ids AS uuid[]))"), {"ids": ids})
    return dict(rows.all())


@pytest.mark.asyncio
async def test_reranks_from_engagement_once_per_slot(db):
    ids = await setup(db)
    result = await auto_rank(db, now=NOON)
    assert result["slot"] == "2026-10-23-pm" and result["listings"] >= len(ids)
    pos = await positions(db, ids)
    assert sorted(pos.values()) == sorted(set(pos.values()))  # unique positions
    # The most visited listing is in the top band. The band fills the first places that are not exploration places,
    # so it ends by position TOP_BAND + (exploration places among them).
    band_end = next(
        p + 1
        for p in range(100)
        if sum(1 for q in range(p + 1) if not (q >= EXPLORE_START and (q - EXPLORE_START) % EXPLORE_EVERY == 0)) == TOP_BAND
    )
    assert pos[ids[-1]] <= band_end

    again = await auto_rank(db, now=NOON)
    assert again["skipped"] == "already ran"


@pytest.mark.asyncio
async def test_a_recent_manual_reorder_is_left_alone(db):
    ids = await setup(db)
    admin = await make_user(db)
    await db.execute(
        text("SELECT public.reorder_listings(CAST(:p AS jsonb), CAST(:a AS uuid))"),
        {"p": f'[{{"listing_id": "{ids[0]}", "new_position": 1}}]', "a": admin},
    )
    before = await positions(db, ids)
    result = await auto_rank(db, now=NOON)
    assert result["skipped"].startswith("manual reorder")
    assert await positions(db, ids) == before


@pytest.mark.asyncio
async def test_popular_follows_recent_views_not_all_time(db):
    from types import SimpleNamespace

    from app.features.listings.service import ListingService

    campus = await make_campus(db)
    agent = await make_agent(db, campus)
    old_favourite = await make_listing(db, agent, campus)
    rising = await make_listing(db, agent, campus)
    for _ in range(30):  # lots of views, but two months ago
        await db.execute(
            text("INSERT INTO listing_views (listing_id, ip_hash, viewed_at) VALUES (CAST(:l AS uuid), md5(random()::text), now() - interval '60 days')"),
            {"l": old_favourite},
        )
    for _ in range(5):  # fewer views, this week
        await db.execute(text("INSERT INTO listing_views (listing_id, ip_hash) VALUES (CAST(:l AS uuid), md5(random()::text))"), {"l": rising})

    listings, _, counts = await ListingService.get_listings_feed(
        db=db, pagination=SimpleNamespace(offset=0, limit=50), sort="views", ids=[old_favourite, rising]
    )
    assert [str(l.id) for l in listings] == [rising, old_favourite]
    assert counts[old_favourite] == 30 and counts[rising] == 5  # the displayed counts stay all-time
