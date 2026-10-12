import pytest
from sqlalchemy import text

from app.features.catalog.service import project_listing
from tests_pg.conftest import make_agent, make_campus, make_listing


@pytest.mark.asyncio
async def test_an_area_with_an_apostrophe_still_finds_its_place(db):
    """King'ong'o is the place `kingongo`; the lookup used to slugify it to `king-ong-o` and leave the listing without a place."""
    await db.execute(text("INSERT INTO places (market_id, kind, name, slug) SELECT id, 'neighbourhood', 'King''ong''o', 'kingongo' FROM markets WHERE slug = 'nyeri' ON CONFLICT (market_id, slug) DO NOTHING"))
    campus = await make_campus(db)
    agent = await make_agent(db, campus)
    listing = await make_listing(db, agent, campus, area="King'ong'o")
    pid = await project_listing(db, listing)
    slug = (await db.execute(text("SELECT pl.slug FROM properties p JOIN places pl ON pl.id = p.place_id WHERE p.id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()
    assert slug == "kingongo"


@pytest.mark.asyncio
async def test_a_listing_with_no_county_takes_the_market_of_its_agents_campus(db):
    from sqlalchemy import select

    from app.features.listings.models import Agent
    from app.features.listings.service import ListingService

    campus = await make_campus(db)
    agent_id = await make_agent(db, campus)
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one()
    assert await ListingService.county_for_agent(db, agent) == "nyeri"  # make_campus builds a campus in Nyeri
