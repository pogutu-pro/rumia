import uuid

import pytest
from sqlalchemy import text

from app.core.errors import NotFoundException
from app.features.events.schemas import EventBatch, EventIn
from app.features.events.service import EventService
from app.features.inquiries.schemas import InquiryCreate
from app.features.inquiries.service import InquiryService
from app.features.saves.service import SaveService
from tests_pg.conftest import make_agent, make_campus, make_listing, make_profile, make_user


async def _listing(db, **kw):
    campus = await make_campus(db)
    agent = await make_agent(db, campus, phone="0712345678")
    return await make_listing(db, agent, campus, title="Kamakwa Heights", price=7500, **kw), agent


@pytest.mark.asyncio
async def test_events_are_stored_deduplicated_and_clamped(db):
    device = str(uuid.uuid4())
    eid = str(uuid.uuid4())
    batch = EventBatch(
        session_id="s1",
        events=[
            EventIn(event_id=eid, name="property_opened", surface="explore", props={"position": 2}),
            EventIn(event_id=eid, name="property_opened"),  # same client id: ignored
            EventIn(name="search_performed", occurred_at="2001-01-01T00:00:00Z", props={"q": "bedsitter"}),
        ],
    )
    await EventService.ingest(db, batch, device, None)
    rows = (await db.execute(text("SELECT name, occurred_at FROM events WHERE device_id = CAST(:d AS uuid)"), {"d": device})).all()
    assert sorted(r[0] for r in rows) == ["property_opened", "search_performed"]
    # An absurd client timestamp is replaced with server time, so it cannot land in the wrong partition.
    assert all(r[1].year >= 2026 for r in rows)


@pytest.mark.asyncio
async def test_contact_without_an_account_returns_whatsapp_link_and_is_bound_to_the_device(db):
    listing, _ = await _listing(db)
    device = str(uuid.uuid4())

    result, notify, title = await InquiryService.create(
        db, InquiryCreate(listing_id=listing, channel="whatsapp", source="property"), device, None, "iphash"
    )
    assert result.whatsapp_url.startswith("https://wa.me/254712345678?text=")
    assert result.ref_code in result.message and "Kamakwa%20Heights" in result.whatsapp_url
    stored = (await db.execute(text("SELECT channel, device_id::text FROM inquiries WHERE ref_code = :r"), {"r": result.ref_code})).one()
    assert stored == ("whatsapp", device)

    # Only the device that made the contact can answer "did they reply?"
    await InquiryService.followup(db, result.ref_code.lower(), device, "yes")
    assert (await db.execute(text("SELECT replied FROM inquiries WHERE ref_code = :r"), {"r": result.ref_code})).scalar_one() == "yes"
    with pytest.raises(NotFoundException):
        await InquiryService.followup(db, result.ref_code, str(uuid.uuid4()), "no")
    with pytest.raises(NotFoundException):
        await InquiryService.followup(db, result.ref_code, None, "no")

    call, _, _ = await InquiryService.create(db, InquiryCreate(listing_id=listing, channel="call"), device, None, "iphash")
    assert call.tel_url == "tel:+254712345678" and call.whatsapp_url is None


@pytest.mark.asyncio
async def test_inactive_listing_cannot_be_contacted(db):
    listing, _ = await _listing(db, is_active=False)
    with pytest.raises(NotFoundException):
        await InquiryService.create(db, InquiryCreate(listing_id=listing), str(uuid.uuid4()), None, "iphash")


@pytest.mark.asyncio
async def test_device_saves_merge_into_the_account_on_sign_in(db):
    listing, _ = await _listing(db)
    device = str(uuid.uuid4())
    await SaveService.add(db, listing, None, device)
    await SaveService.add(db, listing, None, device)  # idempotent
    assert await SaveService.list_ids(db, None, device) == [listing]

    campus = await make_campus(db)
    user = await make_user(db)
    await make_profile(db, user, campus)
    assert await SaveService.merge_device_into_user(db, user, device) == 1
    assert await SaveService.list_ids(db, user, None) == [listing]
    assert await SaveService.list_ids(db, None, device) == []  # device list emptied

    await SaveService.remove(db, listing, user, None)
    assert await SaveService.list_ids(db, user, None) == []
