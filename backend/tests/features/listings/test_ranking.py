from datetime import datetime, timezone

from app.features.listings.ranking import (
    EXPLORE_EVERY,
    EXPLORE_START,
    ListingSignals,
    current_slot,
    new_listing_boost,
    rank,
    score,
)


def make(n: int, **over) -> list:
    out = []
    for i in range(n):
        s = ListingSignals(listing_id=f"id{i:02d}", views=float(n - i) * 5, leads=float((n - i) % 4), quality=60.0, age_days=120.0)
        for k, v in over.get(f"id{i:02d}", {}).items():
            setattr(s, k, v)
        out.append(s)
    return out


def test_slots_are_nairobi_half_days():
    assert current_slot(datetime(2026, 10, 23, 8, 59, tzinfo=timezone.utc)) == "2026-10-23-am"  # 11:59 in Nairobi
    assert current_slot(datetime(2026, 10, 23, 9, 0, tzinfo=timezone.utc)) == "2026-10-23-pm"  # 12:00
    assert current_slot(datetime(2026, 10, 23, 21, 0, tzinfo=timezone.utc)) == "2026-10-24-am"  # 00:00 next day


def test_order_is_complete_unique_and_deterministic():
    signals = make(30)
    a, b = rank(signals, "2026-10-23-am"), rank(signals, "2026-10-23-am")
    assert a == b
    assert sorted(a) == sorted(s.listing_id for s in signals) and len(set(a)) == len(a)


def test_the_top_changes_between_half_days_but_stays_strong():
    signals = make(30)
    firsts = {rank(signals, f"2026-10-{d}-{h}")[0] for d in range(20, 27) for h in ("am", "pm")}
    assert len(firsts) > 1  # not stagnant
    top_performers = {f"id{i:02d}" for i in range(6)}
    assert firsts <= top_performers  # but always one of the best


def test_exploration_places_go_to_less_seen_listings_never_full_ones():
    full = {f"id{i:02d}": {"is_full": True} for i in range(10, 30)}
    signals = make(30, **full)
    order = rank(signals, "2026-10-23-pm")
    explore_positions = range(EXPLORE_START, len(order), EXPLORE_EVERY)
    for p in explore_positions:
        if order[p] in full:  # only once every non-full listing has been placed
            assert all(lid in full for lid in order[p:] if lid in full)
    assert order[EXPLORE_START] not in full


def test_engagement_quality_and_newness_raise_the_score():
    base = ListingSignals("x", views=10, quality=50, age_days=120)
    assert score(ListingSignals("x", views=40, quality=50, age_days=120), "s") > score(base, "s")
    assert score(ListingSignals("x", views=10, tours=2, quality=50, age_days=120), "s") > score(base, "s")
    assert score(ListingSignals("x", views=10, quality=90, age_days=120), "s") > score(base, "s")
    assert score(ListingSignals("x", views=10, quality=50, age_days=3), "s") > score(base, "s")
    assert score(ListingSignals("x", views=10, quality=50, age_days=120, is_full=True), "s") < score(base, "s")
    assert new_listing_boost(3) > new_listing_boost(20) > new_listing_boost(40) == 0
