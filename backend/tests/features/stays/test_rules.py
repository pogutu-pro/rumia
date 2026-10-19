import pytest

from app.core.errors import BadRequestException
from app.core.permissions import AccessContext
from app.features.stays.service import decide_outcome, clean_guest_phone


@pytest.mark.parametrize(
    "guest,host,expected",
    [
        (None, None, None),
        ("stayed", None, "completed"),
        (None, "stayed", "completed"),
        ("stayed", "stayed", "completed"),
        (None, "did_not_stay", "no_show"),
        ("did_not_stay", "did_not_stay", "no_show"),
        ("stayed", "did_not_stay", "disputed"),
        ("did_not_stay", "stayed", "disputed"),
    ],
)
def test_reports_decide_the_outcome(guest, host, expected):
    assert decide_outcome(guest, host) == expected


def test_guest_phone_kenyan_and_international():
    assert clean_guest_phone("0712 345 678") == "+254712345678"
    assert clean_guest_phone("+254712345678") == "+254712345678"
    assert clean_guest_phone("+44 7700 900123") == "+447700900123"
    with pytest.raises(BadRequestException):
        clean_guest_phone("+12")
    with pytest.raises(BadRequestException):
        clean_guest_phone("12345")


def test_only_admin_and_market_leads_run_the_concierge():
    assert AccessContext(user_id="u", staff={("admin", None)}).can_staff_anywhere("bnb.concierge")
    assert AccessContext(user_id="u", staff={("market_lead", "m1")}).can_staff_anywhere("bnb.concierge")
    assert not AccessContext(user_id="u", staff={("scout", None)}).can_staff_anywhere("bnb.concierge")
    assert not AccessContext(user_id="u", orgs={"o1": "owner"}).can_staff_anywhere("bnb.concierge")


def test_every_member_role_can_handle_their_own_requests():
    for role in ("owner", "manager", "agent"):
        ctx = AccessContext(user_id="u", orgs={"o1": role})
        assert ctx.can("property.confirm", org_id="o1")
        assert not ctx.can("property.confirm", org_id="o2")


def test_concierge_message_carries_dates_and_guests():
    from datetime import date

    from app.features.stays.service import concierge_message

    assert concierge_message("Regal Residence", date(2026, 12, 1), date(2026, 12, 4), 2, "AB2CD") == (
        "Hi RumiaBnB, is *Regal Residence* available from 1 Dec to 4 Dec 2026 for 2 guests? Ref AB2CD"
    )
    assert concierge_message("Regal", date(2026, 12, 30), date(2027, 1, 2), 1, "X") == (
        "Hi RumiaBnB, is *Regal* available from 30 Dec 2026 to 2 Jan 2027 for 1 guest? Ref X"
    )
    assert concierge_message(None, None, None, None, "X") == "Hi RumiaBnB, I'd like to check availability for a place to stay. My dates are: … Ref X"
