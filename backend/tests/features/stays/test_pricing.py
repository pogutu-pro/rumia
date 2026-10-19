from datetime import date
from decimal import Decimal as D

import pytest

from app.features.stays.pricing import FeeTerms, quote_stay, stay_fee

TERMS = FeeTerms(percent=D(10), minimum=D(500), night_cap=30)


def test_nightly_quote():
    q = quote_stay(date(2026, 11, 1), date(2026, 11, 4), D(4000), cleaning_fee=D(500))
    assert (q.nights, q.rate_basis, q.room_total, q.total) == (3, "night", D(12000), D(12500))


def test_weekly_rate_applies_from_seven_nights():
    q = quote_stay(date(2026, 11, 1), date(2026, 11, 15), D(4000), weekly=D(21000))
    assert (q.rate_basis, q.room_total) == ("week", D(42000))


def test_monthly_rate_beats_weekly_from_thirty_nights():
    q = quote_stay(date(2026, 11, 1), date(2027, 1, 1), D(4000), weekly=D(21000), monthly=D(60000))
    assert q.nights == 61
    assert q.rate_basis == "month"
    assert q.room_total == D(122000)


def test_long_stay_rate_never_costs_more_than_nightly():
    q = quote_stay(date(2026, 11, 1), date(2026, 11, 8), D(1000), weekly=D(9000))
    assert (q.rate_basis, q.room_total) == ("night", D(7000))


def test_rejects_empty_stay():
    with pytest.raises(ValueError):
        quote_stay(date(2026, 11, 1), date(2026, 11, 1), D(4000))


def test_fee_is_ten_percent_of_room_charges():
    assert stay_fee(D(12000), 3, TERMS) == D(1200)


def test_fee_minimum():
    assert stay_fee(D(3000), 1, TERMS) == D(500)


def test_minimum_never_exceeds_room_charges():
    assert stay_fee(D(400), 1, TERMS) == D(400)


def test_fee_only_on_first_thirty_nights():
    # 61 nights for 122,000: the fee base is 30/61 of it (60,000), so the fee is 6,000.
    assert stay_fee(D(122000), 61, TERMS) == D(6000)


def test_no_fee_without_terms_or_room_charges():
    assert stay_fee(D(0), 3, TERMS) == D(0)
    assert stay_fee(D(12000), 3, FeeTerms(D(0), D(500), 30)) == D(0)
