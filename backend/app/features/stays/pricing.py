"""Prices and fees for RumiaBnB stays. Pure functions: no database, easy to test and to explain to a host.

Quote: the nightly price, or the owner's weekly/monthly rate when the stay is long enough and the owner set one.
Fee:   a percentage of the room charges (cleaning fee and deposit excluded), at least a minimum, charged on the first
       `night_cap` nights only so long stays are not penalised.
"""
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

WEEK = 7
MONTH = 30


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Quote:
    nights: int
    rate_basis: str  # night | week | month
    room_total: Decimal  # what the guest pays for the room, before cleaning fee and deposit
    cleaning_fee: Optional[Decimal]

    @property
    def total(self) -> Decimal:
        return self.room_total + (self.cleaning_fee or Decimal(0))


def quote_stay(
    check_in: date,
    check_out: date,
    nightly: Decimal,
    weekly: Optional[Decimal] = None,
    monthly: Optional[Decimal] = None,
    cleaning_fee: Optional[Decimal] = None,
) -> Quote:
    nights = (check_out - check_in).days
    if nights < 1:
        raise ValueError("check_out must be after check_in")
    if monthly and nights >= MONTH:
        basis, total = "month", monthly * nights / MONTH
    elif weekly and nights >= WEEK:
        basis, total = "week", weekly * nights / WEEK
    else:
        basis, total = "night", nightly * nights
    # A longer-stay rate never costs the guest more than paying by the night.
    if total > nightly * nights:
        basis, total = "night", nightly * nights
    return Quote(nights=nights, rate_basis=basis, room_total=_money(total), cleaning_fee=_money(cleaning_fee) if cleaning_fee else None)


@dataclass(frozen=True)
class FeeTerms:
    percent: Decimal
    minimum: Decimal
    night_cap: Optional[int]


def stay_fee(room_total: Decimal, nights: int, terms: FeeTerms) -> Decimal:
    """The success fee for a completed stay."""
    if nights < 1 or room_total <= 0 or terms.percent <= 0:
        return Decimal(0)
    base = room_total
    if terms.night_cap and nights > terms.night_cap:
        base = room_total * terms.night_cap / nights
    fee = base * terms.percent / 100
    # The minimum never exceeds the room charges themselves.
    return _money(min(max(fee, terms.minimum), room_total))
