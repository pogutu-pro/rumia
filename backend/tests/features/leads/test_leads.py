from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.errors import APIException, NotFoundException
from app.features.leads.models import Commission, Lead
from app.features.leads.schemas import LeadTrackRequest
from app.features.leads.service import LeadService
from tests.conftest import MockResult

LISTING_ID = "8f853c92-36bf-455d-b21f-14471ec16311"
AGENT_ID = "9a1b2c3d-36bf-455d-b21f-14471ec16312"


def _listing(**overrides):
    base = dict(
        id=LISTING_ID, agent_id=AGENT_ID, campus_id="campus-1", title="Hostel One", price=12000,
        room_type="Bedsitter", area="Boma", slug="hostel-one", county="Nyeri", youtube_id=None,
        is_full=False, pays_commission=False, landlord_phone="0711000000",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _agent():
    return SimpleNamespace(
        id=AGENT_ID, user_id="agent-user-1", name="Agent A", whatsapp="0722000000", phone="0722000001",
        pochi_la_biashara_number="0733000000", expected_name="Agent A",
    )


def _db(*results):
    """A session whose successive execute() calls return the given MockResults."""
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.flush = AsyncMock()
    return db


def _request(**kw):
    return LeadTrackRequest(listing_id=LISTING_ID, **kw)


@pytest.mark.asyncio
async def test_rumia_agent_requires_fee_acceptance_when_no_commission():
    db = _db(MockResult(single=_listing()), MockResult(single=_agent()))
    with pytest.raises(APIException) as exc:
        await LeadService.track_lead(db, _request(), "hash")
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "FEE_REQUIRED"
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_full_hostel_cannot_be_contacted_through_owner():
    db = _db(MockResult(single=_listing(is_full=True)))
    with pytest.raises(APIException) as exc:
        await LeadService.track_lead(db, _request(contact_type="hostel_owner"), "hash")
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "REQUIRES_AGENT"


@pytest.mark.asyncio
async def test_unknown_listing_is_404():
    db = _db(MockResult(single=None))
    with pytest.raises(NotFoundException):
        await LeadService.track_lead(db, _request(), "hash")


@pytest.mark.asyncio
async def test_records_lead_with_fee_accepted_and_notifies_agent():
    db = _db(
        MockResult(single=_listing()), MockResult(single=_agent()),
        MockResult(single=None),                # no duplicate
        MockResult(single=100),                 # campus consultation fee
    )
    out = await LeadService.track_lead(db, _request(fee_accepted=True, name="Stu", phone="0700"), "hash")

    assert out.result.recorded is True
    assert out.notify_user_id == "agent-user-1"
    assert out.result.consultation_fee == 100.0
    assert out.result.listing.landlord_phone is None  # owner number never leaks for agent contact
    added = [c.args[0] for c in db.add.call_args_list]
    assert [type(a) for a in added] == [Lead]
    assert added[0].agent_id == AGENT_ID and added[0].name == "Stu" and added[0].contact_type == "rumia_agent"


@pytest.mark.asyncio
async def test_duplicate_click_within_24h_is_not_recorded_or_notified():
    db = _db(
        MockResult(single=_listing(pays_commission=True)), MockResult(single=_agent()),
        MockResult(single="existing-lead-id"),  # duplicate found
        MockResult(single=None),
    )
    out = await LeadService.track_lead(db, _request(), "hash")
    assert out.result.recorded is False
    assert out.notify_user_id is None
    db.add.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("price,expected", [(5000, 1000), (12000, 1200), (30000, 3000)])
async def test_commission_is_ten_percent_with_1000_minimum(price, expected):
    db = _db(
        MockResult(single=_listing(pays_commission=True, price=price)), MockResult(single=_agent()),
        MockResult(single=None),
        MockResult(),                            # UPDATE agents balance
        MockResult(single=None),                 # campus fee
    )
    out = await LeadService.track_lead(db, _request(), "hash")
    assert out.result.recorded is True
    commissions = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Commission)]
    assert len(commissions) == 1 and commissions[0].amount == expected and commissions[0].status == "pending"


@pytest.mark.asyncio
async def test_hostel_owner_contact_returns_landlord_phone_only_for_owner_type():
    db = _db(
        MockResult(single=_listing()), MockResult(single=_agent()),
        MockResult(single=None), MockResult(single=None),
    )
    out = await LeadService.track_lead(db, _request(contact_type="hostel_owner"), "hash")
    assert out.result.listing.landlord_phone == "0711000000"


@pytest.mark.asyncio
async def test_track_endpoint_hashes_client_ip_and_schedules_push(client: AsyncClient):
    from app.features.leads.schemas import LeadContactAgent, LeadContactListing, LeadTrackResult
    from app.features.leads.service import TrackedLead

    tracked = TrackedLead(
        result=LeadTrackResult(
            recorded=True, contact_type="rumia_agent",
            agent=LeadContactAgent(name="A", whatsapp="072"),
            listing=LeadContactListing(title="Hostel One", price=1.0),
        ),
        notify_user_id="agent-user-1", listing_title="Hostel One", agent_id=AGENT_ID, listing_id=LISTING_ID,
    )
    with (
        patch("app.features.leads.service.LeadService.track_lead", new_callable=AsyncMock, return_value=tracked) as svc,
        patch("app.features.leads.router.send_push_to_user", new_callable=AsyncMock) as push,
    ):
        response = await client.post(
            "/api/v1/leads/track",
            json={"listing_id": LISTING_ID, "contact_type": "rumia_agent", "fee_accepted": True},
            headers={"x-forwarded-for": "203.0.113.9"},
        )
    assert response.status_code == 200
    assert response.json()["recorded"] is True
    ip_hash = svc.await_args.args[2]
    import hashlib
    assert ip_hash == hashlib.sha256(b"203.0.113.9").hexdigest()
    push.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_leads_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/leads")
    assert response.status_code == 401
