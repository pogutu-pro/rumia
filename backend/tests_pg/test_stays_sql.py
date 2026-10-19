"""RumiaBnB stays against real Postgres: attribution, requests, the lifecycle, reports and the stay fee."""
from datetime import date, timedelta

import pytest
from sqlalchemy import text

from app.core.errors import BadRequestException, ConflictException, NotFoundException
from app.features.catalog.service import project_listing
from app.features.stays import service as stays_service
from app.features.stays.schemas import Attribution
from app.features.stays.service import StayService
from tests_pg.conftest import make_agent, make_campus, make_listing, make_user

TODAY = date(2026, 11, 2)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr(stays_service, "today", lambda: TODAY)
    monkeypatch.setattr(stays_service.settings, "BNB_FEE_PERCENT", 10)
    monkeypatch.setattr(stays_service.settings, "BNB_FEE_MIN_KES", 500)
    monkeypatch.setattr(stays_service.settings, "BNB_FEE_NIGHT_CAP", 30)


async def _stay(db, *, price=4000, weekly=None, max_guests=4, user_id=None):
    campus = await make_campus(db)
    agent = await make_agent(db, campus, user_id=user_id, phone="0712345678")
    listing = await make_listing(db, agent, campus, title="Regal Cottage", property_type="short_stay", price=price)
    await db.execute(
        text("INSERT INTO bnb_details (listing_id, max_guests, cleaning_fee, weekly_price) VALUES (CAST(:l AS uuid), :g, 500, :w)"),
        {"l": listing, "g": max_guests, "w": weekly},
    )
    await project_listing(db, listing)
    org = (await db.execute(text("SELECT org_id FROM properties WHERE legacy_listing_id = CAST(:l AS uuid)"), {"l": listing})).scalar_one()
    return listing, str(org)


async def _request(db, listing, *, check_in=date(2026, 11, 10), nights=3, phone="0722000111", **kw):
    return await StayService.create_request(
        db, listing_ident=listing, check_in=check_in, check_out=check_in + timedelta(days=nights), guests=2,
        guest_name="Wanjiru", guest_phone=phone, guest_email=None, note="Arriving late",
        attribution=kw.pop("attribution", Attribution(utm_source="tiktok", utm_campaign="regal-oct", heard_from="TikTok")),
        origin=kw.pop("origin", "guest"), **kw,
    )


async def _fee(db, req_id):
    return (
        await db.execute(
            text("SELECT amount, status FROM ledger_entries WHERE stay_request_id = CAST(:r AS uuid) AND kind = 'stay_fee'"), {"r": req_id}
        )
    ).first()


@pytest.mark.asyncio
async def test_request_records_attributed_contact_and_quote(db):
    listing, org = await _stay(db)
    created = await _request(db, listing)
    assert created["status"] == "requested" and not created["duplicate"]
    assert created["quote"].room_total == 12000 and created["quote"].total == 12500
    row = (
        await db.execute(
            text(
                """
                SELECT i.product, i.channel, i.handled_by, i.utm_source, i.utm_campaign, i.heard_from, r.org_id, r.guest_phone, r.nights
                FROM stay_requests r JOIN inquiries i ON i.id = r.inquiry_id WHERE r.id = CAST(:r AS uuid)
                """
            ),
            {"r": created["id"]},
        )
    ).one()
    assert tuple(row[:6]) == ("bnb", "request", "host", "tiktok", "regal-oct", "TikTok")
    assert str(row[6]) == org and row[7] == "+254722000111" and row[8] == 3


@pytest.mark.asyncio
async def test_same_guest_same_dates_is_not_counted_twice(db):
    listing, _ = await _stay(db)
    first = await _request(db, listing)
    again = await _request(db, listing, phone="+254 722 000 111", check_in=date(2026, 11, 11))
    assert again["duplicate"] and again["id"] == first["id"] and again["ref_code"] == first["ref_code"]
    # The new status link works; the old one no longer does.
    assert (await StayService.by_token(db, again["token"]))["id"] == first["id"]
    with pytest.raises(NotFoundException):
        await StayService.by_token(db, first["token"])
    count = (await db.execute(text("SELECT count(*) FROM stay_requests WHERE listing_id = CAST(:l AS uuid)"), {"l": listing})).scalar_one()
    assert count == 1


@pytest.mark.asyncio
async def test_validation(db):
    listing, _ = await _stay(db, max_guests=1)
    with pytest.raises(BadRequestException):
        await _request(db, listing)  # 2 guests, max 1
    listing2, _ = await _stay(db)
    with pytest.raises(BadRequestException):
        await _request(db, listing2, check_in=date(2026, 10, 1))  # in the past
    with pytest.raises(NotFoundException):
        await StayService.resolve_listing(db, "no-such-stay")


@pytest.mark.asyncio
async def test_guest_or_host_report_completes_stay_and_records_one_fee(db):
    listing, org = await _stay(db)
    created = await _request(db, listing, check_in=date(2026, 11, 2))
    req = await StayService.for_org(db, org, created["id"])
    with pytest.raises(ConflictException):
        await StayService.report(db, req, "guest", True)  # not confirmed yet
    await StayService.move(db, req, "confirmed", actor="host", agreed_total=11000)
    assert await StayService.report(db, req, "guest", True) == "completed"
    assert tuple(await _fee(db, created["id"])) == (1100, "pending")  # 10% of the agreed 11,000
    # The host agreeing changes nothing; there is still exactly one fee.
    req = await StayService.for_org(db, org, created["id"])
    assert await StayService.report(db, req, "host", True) == "completed"
    n = (await db.execute(text("SELECT count(*) FROM ledger_entries WHERE stay_request_id = CAST(:r AS uuid)"), {"r": created["id"]})).scalar_one()
    assert n == 1


@pytest.mark.asyncio
async def test_conflicting_reports_dispute_and_staff_resolve(db):
    listing, org = await _stay(db)
    created = await _request(db, listing, check_in=date(2026, 11, 1), nights=1, origin="concierge")
    req = await StayService.by_id(db, created["id"])
    await StayService.move(db, req, "confirmed", actor="host")
    await StayService.report(db, req, "host", False)
    assert req["status"] == "no_show" and await _fee(db, created["id"]) is None
    req = await StayService.by_id(db, created["id"])
    assert await StayService.report(db, req, "guest", True) == "disputed"
    req = await StayService.by_id(db, created["id"])
    await StayService.move(db, req, "completed", actor="staff", note="M-Pesa receipt seen")
    assert tuple(await _fee(db, created["id"])) == (500, "pending")  # 10% of 4,000 is below the minimum
    req = await StayService.by_id(db, created["id"])
    await StayService.move(db, req, "no_show", actor="staff", note="Receipt was for another booking")
    assert (await _fee(db, created["id"]))[1] == "void"
    events = (await StayService.detail(db, created["id"]))["events"]
    assert [e["to_status"] for e in events if e["action"] == "status"] == ["confirmed", "no_show", "disputed", "completed", "no_show"]


@pytest.mark.asyncio
async def test_transitions_are_limited_by_who_acts(db):
    listing, org = await _stay(db)
    created = await _request(db, listing)
    req = await StayService.for_org(db, org, created["id"])
    with pytest.raises(ConflictException):
        await StayService.move(db, req, "completed", actor="host")
    with pytest.raises(ConflictException):
        await StayService.move(db, req, "confirmed", actor="guest")
    await StayService.move(db, req, "cancelled", actor="guest")
    with pytest.raises(ConflictException):
        await StayService.move(db, req, "confirmed", actor="host")


@pytest.mark.asyncio
async def test_host_sees_only_their_own_requests(db):
    listing, org = await _stay(db)
    other_listing, other_org = await _stay(db)
    created = await _request(db, listing)
    with pytest.raises(NotFoundException):
        await StayService.for_org(db, other_org, created["id"])
    assert [r["id"] for r in await StayService.list_requests(db, org_ids=[other_org])] == []
    assert [r["id"] for r in await StayService.list_requests(db, org_ids=[org])] == [created["id"]]


@pytest.mark.asyncio
async def test_host_agreement_overrides_default_terms_and_cap(db):
    listing, org = await _stay(db, price=2000)
    staff = await make_user(db)
    await StayService.add_agreement(db, org, 8, 300, 30, date(2026, 10, 1), "Signed at the visit", staff)
    created = await _request(db, listing, check_in=date(2026, 11, 2), nights=60)  # 120,000 room charges
    req = await StayService.by_id(db, created["id"])
    await StayService.move(db, req, "confirmed", actor="host")
    await StayService.report(db, req, "host", True)
    assert tuple(await _fee(db, created["id"])) == (4800, "pending")  # 8% of the first 30 nights (60,000)
    # A newer agreement closes the previous one.
    await StayService.add_agreement(db, org, 12, 500, 30, date(2026, 12, 1), None, staff)
    rows = (await db.execute(text("SELECT fee_percent, effective_to FROM host_agreements WHERE org_id = CAST(:o AS uuid) ORDER BY effective_from"), {"o": org})).all()
    assert [(float(r[0]), r[1]) for r in rows] == [(8.0, date(2026, 11, 30)), (12.0, None)]


@pytest.mark.asyncio
async def test_concierge_chat_then_booking_keeps_its_source(db, monkeypatch):
    listing, org = await _stay(db)
    monkeypatch.setattr(stays_service.settings, "BNB_CONCIERGE_WHATSAPP", "+254 700 000 999")
    ref, url, message = await StayService.concierge_contact(db, None, Attribution(utm_source="instagram"), None, None, "s1")
    assert url.startswith("https://wa.me/254700000999?text=") and ref in message
    staff = await make_user(db)
    created = await _request(db, listing, origin="concierge", ref_code=ref.lower(), staff_user_id=staff)
    assert created["ref_code"] == ref
    row = (
        await db.execute(text("SELECT i.utm_source, i.listing_id, r.origin FROM stay_requests r JOIN inquiries i ON i.id = r.inquiry_id WHERE r.id = CAST(:r AS uuid)"), {"r": created["id"]})
    ).one()
    assert row[0] == "instagram" and str(row[1]) == listing and row[2] == "concierge"
    with pytest.raises(ConflictException):
        await _request(db, listing, origin="concierge", ref_code=ref, phone="0733000222")


@pytest.mark.asyncio
async def test_weekly_rate_and_summary(db):
    listing, org = await _stay(db, weekly=21000)
    created = await _request(db, listing, check_in=date(2026, 11, 2), nights=7)
    assert created["quote"].rate_basis == "week" and created["quote"].room_total == 21000
    await db.execute(
        text("INSERT INTO events (occurred_at, name, listing_id) VALUES (now(), 'property_opened', CAST(:l AS uuid)), (now(), 'property_opened', CAST(:l AS uuid))"),
        {"l": listing},
    )
    req = await StayService.by_id(db, created["id"])
    await StayService.move(db, req, "confirmed", actor="host")
    await StayService.report(db, req, "guest", True)
    s = await StayService.summary(db, org, date(2026, 1, 1))
    assert (s["views"], s["contacts"], s["requests"], s["confirmed"], s["completed"]) == (2, 1, 1, 1, 1)
    assert s["room_value_completed"] == 21000 and s["fees_pending"] == 2100
    assert s["by_source"] == [{"source": "tiktok", "contacts": 1, "requests": 1, "completed": 1}]
