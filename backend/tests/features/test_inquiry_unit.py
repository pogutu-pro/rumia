from types import SimpleNamespace

import pytest

from app.core.device import parse_device_id
from app.core.errors import ConflictException
from app.features.inquiries.service import REF_ALPHABET, REF_LENGTH, build_message, new_ref_code, pick_contact


def test_ref_codes_are_short_and_unambiguous():
    for _ in range(200):
        code = new_ref_code()
        assert len(code) == REF_LENGTH and set(code) <= set(REF_ALPHABET)
    assert not set("01OI") & set(REF_ALPHABET)


def test_message_carries_title_price_and_ref():
    msg = build_message("Kamakwa Heights", 7500, "/month", "R7K2P")
    assert "*Kamakwa Heights*" in msg and "KSh 7,500/month" in msg and msg.endswith("Ref R7K2P")


def test_contact_policy():
    listing = SimpleNamespace(landlord_phone="0711111111")
    agent = SimpleNamespace(name="Mary", whatsapp="0722222222", phone="0733333333")
    assert pick_contact(listing, agent, "agent_first") == ("Mary", "0722222222")
    assert pick_contact(listing, agent, "owner_first") == ("the owner", "0711111111")
    # Falls back to whoever has a number
    assert pick_contact(SimpleNamespace(landlord_phone="0711111111"), SimpleNamespace(name="M", whatsapp=None, phone=None), "agent_first")[1] == "0711111111"
    with pytest.raises(ConflictException):
        pick_contact(SimpleNamespace(landlord_phone=None), SimpleNamespace(name="M", whatsapp=None, phone=None), "agent_first")


def test_device_id_parsing():
    assert parse_device_id("3F2504E0-4F89-11D3-9A0C-0305E82C3301") == "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
    assert parse_device_id("not-a-uuid") is None
    assert parse_device_id(None) is None
