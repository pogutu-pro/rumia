import pytest
from sqlalchemy import text

from app.features.leads.schemas import LeadTrackRequest
from app.features.leads.service import LeadService
from tests_pg.conftest import make_agent, make_campus, make_listing


@pytest.mark.asyncio
async def test_same_visitor_is_recorded_once_per_listing_and_commission_accrues_once(db):
    campus = await make_campus(db)
    agent = await make_agent(db, campus)
    listing = await make_listing(db, agent, campus, price=10000, pays_commission=True)
    req = LeadTrackRequest(listing_id=listing, contact_type="hostel_owner")

    first = await LeadService.track_lead(db, req, ip_hash="visitor-a")
    second = await LeadService.track_lead(db, req, ip_hash="visitor-a")
    other = await LeadService.track_lead(db, req, ip_hash="visitor-b")

    assert first.result.recorded and not second.result.recorded and other.result.recorded
    leads = (await db.execute(text("SELECT count(*) FROM leads WHERE listing_id = :l"), {"l": listing})).scalar_one()
    assert leads == 2
    # 10% of 10,000 = 1,000 per recorded lead, added to the agent's balance atomically.
    balance = (await db.execute(text("SELECT commission_balance FROM agents WHERE id = :a"), {"a": agent})).scalar_one()
    assert float(balance) == 2000.0
