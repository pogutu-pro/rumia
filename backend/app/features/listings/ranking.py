"""Automatic listing order: re-ranks every active listing twice a day from what people actually do.

`sort_position` has always decided the order everywhere (feed, search, home, Explore, the admin console), and an admin
had to set it by hand: the last manual reorder sat unchanged for six weeks. This job rewrites `sort_position` from
recent engagement, listing quality and freshness, with a small rotation so near-equals trade places each half-day.
Nothing that reads the order changes.

Signals (last 30 days, each weighted by how recent it is, half-life 7 days):
  views (deduplicated per visitor) 1 · contact clicks 6 · inquiries 6 · tour bookings 10 · saves 4
Score = log(1 + engagement) + quality (0-100 -> 0-1.5) + new-listing boost + rotation, minus a full-house penalty.

Pure popularity feeds itself (the top gets the views that keep it on top), so the final order mixes two lists, the
way large marketplaces keep results fresh:
  - the TOP_BAND best performers, shuffled each half-day, so the first places change twice a day;
  - from position 3, every EXPLORE_EVERY-th place is a less-seen listing picked by the slot's rotation, so every
    listing gets real exposure and fresh interest can lift it.

Safety and cost:
  - Runs at most once per half-day slot (Nairobi time), checked every 30 minutes; the work is one aggregate query over
    a month of rows (milliseconds) and one set-based UPDATE in a single transaction.
  - An admin's manual reorder wins: no automatic run within 24 hours of one.
  - Writes only rows whose position changes; if anything fails, the transaction rolls back and the old order stays.
"""
import hashlib
import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

NAIROBI = timezone(timedelta(hours=3))
HALF_LIFE_DAYS = 7.0
WINDOW_DAYS = 30
MANUAL_HOLD_HOURS = 24
WEIGHTS = {"views": 1.0, "leads": 6.0, "inquiries": 6.0, "tours": 10.0, "saves": 4.0}
QUALITY_WEIGHT = 1.5  # quality_score is 0-100
NEW_BOOST = 1.2  # full for the first 14 days, fading to 0 by day 30
FULL_PENALTY = 2.0
ROTATION = 0.35  # a near-tie reshuffle each half-day; small next to real engagement differences
TOP_BAND = 6
EXPLORE_START = 2  # 0-based: exploration begins at the 3rd place
EXPLORE_EVERY = 3


@dataclass
class ListingSignals:
    listing_id: str
    views: float = 0.0
    leads: float = 0.0
    inquiries: float = 0.0
    tours: float = 0.0
    saves: float = 0.0
    quality: Optional[float] = None
    age_days: float = 365.0
    is_full: bool = False


def current_slot(now: Optional[datetime] = None) -> str:
    """'2026-10-23-am' or '-pm' in Nairobi time: the job runs once per slot."""
    local = (now or datetime.now(timezone.utc)).astimezone(NAIROBI)
    return f"{local:%Y-%m-%d}-{'am' if local.hour < 12 else 'pm'}"


def rotation(listing_id: str, slot: str) -> float:
    """Deterministic in [0, ROTATION): the same within a slot (stable pages), different across slots."""
    digest = hashlib.sha256(f"{listing_id}:{slot}".encode()).digest()
    return int.from_bytes(digest[:4], "big") / 2**32 * ROTATION


def new_listing_boost(age_days: float) -> float:
    if age_days <= 14:
        return NEW_BOOST
    if age_days >= 30:
        return 0.0
    return NEW_BOOST * (30 - age_days) / 16


def score(s: ListingSignals, slot: str) -> float:
    engagement = sum(WEIGHTS[k] * getattr(s, k) for k in WEIGHTS)
    quality = (s.quality or 0.0) / 100 * QUALITY_WEIGHT
    total = math.log1p(engagement) + quality + new_listing_boost(s.age_days) + rotation(s.listing_id, slot)
    return total - (FULL_PENALTY if s.is_full else 0.0)


def rank(signals: List[ListingSignals], slot: str) -> List[str]:
    """Listing ids in display order for this slot. Deterministic: the same inputs and slot give the same order."""
    by_score = [s.listing_id for s in sorted(signals, key=lambda s: (-score(s, slot), s.listing_id))]
    full = {s.listing_id for s in signals if s.is_full}

    # The best performers stay on top but trade places each half-day.
    band = sorted(by_score[:TOP_BAND], key=lambda lid: rotation(lid, slot + ":band"))
    rest = by_score[TOP_BAND:]
    # Less-seen listings (everything below the band, never a full house) take turns in the exploration places.
    explore = sorted((lid for lid in rest if lid not in full), key=lambda lid: rotation(lid, slot + ":explore"))

    order: List[str] = []
    used: set = set()
    performers = iter(band + rest)
    explorers = iter(explore)

    def take(it):
        for lid in it:
            if lid not in used:
                used.add(lid)
                return lid
        return None

    while len(order) < len(by_score):
        position = len(order)
        pick = None
        if position >= EXPLORE_START and (position - EXPLORE_START) % EXPLORE_EVERY == 0:
            pick = take(explorers)
        if pick is None:
            pick = take(performers)
        if pick is None:
            pick = take(explorers)
        if pick is None:
            break
        order.append(pick)
    return order


# Decay factor for an event `age` ago: exp(-ln2 * age_days / half_life). Evaluated in SQL so only sums come back.
_DECAY = "exp(-0.6931 * extract(epoch FROM (now() - {col})) / 86400.0 / {hl})"

_SIGNALS_SQL = f"""
WITH active AS (
  SELECT id, created_at, coalesce(is_full, false) AS is_full FROM listings WHERE is_active
),
v AS (SELECT listing_id, sum({_DECAY.format(col='viewed_at', hl=HALF_LIFE_DAYS)}) AS n FROM listing_views
      WHERE viewed_at > now() - interval '{WINDOW_DAYS} days' GROUP BY 1),
l AS (SELECT listing_id, sum({_DECAY.format(col='clicked_at', hl=HALF_LIFE_DAYS)}) AS n FROM leads
      WHERE clicked_at > now() - interval '{WINDOW_DAYS} days' GROUP BY 1),
i AS (SELECT listing_id, sum({_DECAY.format(col='created_at', hl=HALF_LIFE_DAYS)}) AS n FROM inquiries
      WHERE created_at > now() - interval '{WINDOW_DAYS} days' AND listing_id IS NOT NULL GROUP BY 1),
t AS (SELECT listing_id, sum({_DECAY.format(col='created_at', hl=HALF_LIFE_DAYS)}) AS n FROM tour_bookings
      WHERE created_at > now() - interval '{WINDOW_DAYS} days' AND listing_id IS NOT NULL GROUP BY 1),
s AS (SELECT listing_id, sum(d) AS n FROM (
        SELECT listing_id, {_DECAY.format(col='created_at', hl=HALF_LIFE_DAYS)} AS d FROM device_saves
         WHERE created_at > now() - interval '{WINDOW_DAYS} days'
        UNION ALL
        SELECT listing_id, {_DECAY.format(col='created_at', hl=HALF_LIFE_DAYS)} FROM wishlists
         WHERE created_at > now() - interval '{WINDOW_DAYS} days') x GROUP BY 1),
q AS (SELECT legacy_listing_id AS listing_id, max(quality_score) AS quality FROM properties
      WHERE legacy_listing_id IS NOT NULL GROUP BY 1)
SELECT a.id::text AS listing_id,
       coalesce(v.n, 0) AS views, coalesce(l.n, 0) AS leads, coalesce(i.n, 0) AS inquiries,
       coalesce(t.n, 0) AS tours, coalesce(s.n, 0) AS saves, q.quality,
       extract(epoch FROM (now() - a.created_at)) / 86400.0 AS age_days, a.is_full
FROM active a
LEFT JOIN v ON v.listing_id = a.id LEFT JOIN l ON l.listing_id = a.id LEFT JOIN i ON i.listing_id = a.id
LEFT JOIN t ON t.listing_id = a.id LEFT JOIN s ON s.listing_id = a.id LEFT JOIN q ON q.listing_id = a.id
"""


async def _ensure_runs_table(db: AsyncSession) -> None:
    # Created here, like the event partitions, so a deploy never depends on a manual migration step.
    await db.execute(
        text(
            """CREATE TABLE IF NOT EXISTS listing_rank_runs (
                 slot text PRIMARY KEY, ran_at timestamptz NOT NULL DEFAULT now(), listings int NOT NULL, moved int NOT NULL)"""
        )
    )


async def auto_rank(db: AsyncSession, now: Optional[datetime] = None) -> Dict[str, object]:
    """Re-rank active listings once per half-day slot. Returns what happened (for the log). Caller commits."""
    slot = current_slot(now)
    await _ensure_runs_table(db)
    if (await db.execute(text("SELECT 1 FROM listing_rank_runs WHERE slot = :s"), {"s": slot})).first():
        return {"slot": slot, "skipped": "already ran"}
    manual = (
        await db.execute(
            text("SELECT 1 FROM listing_sort_history WHERE changed_at > now() - make_interval(hours => :h) LIMIT 1"),
            {"h": MANUAL_HOLD_HOURS},
        )
    ).first()
    if manual:
        return {"slot": slot, "skipped": "manual reorder in the last 24 hours"}

    rows = (await db.execute(text(_SIGNALS_SQL))).mappings().all()
    signals = [
        ListingSignals(
            listing_id=r["listing_id"], views=float(r["views"]), leads=float(r["leads"]), inquiries=float(r["inquiries"]),
            tours=float(r["tours"]), saves=float(r["saves"]),
            quality=float(r["quality"]) if r["quality"] is not None else None,
            age_days=float(r["age_days"] or 365), is_full=bool(r["is_full"]),
        )
        for r in rows
    ]
    order = rank(signals, slot)
    positions = [{"id": lid, "pos": i + 1} for i, lid in enumerate(order)]
    import json

    moved = 0
    if positions:
        result = await db.execute(
            text(
                """UPDATE listings l SET sort_position = p.pos
                   FROM jsonb_to_recordset(CAST(:p AS jsonb)) AS p(id uuid, pos int)
                   WHERE l.id = p.id AND l.sort_position IS DISTINCT FROM p.pos"""
            ),
            {"p": json.dumps(positions)},
        )
        moved = result.rowcount or 0
    await db.execute(
        text("INSERT INTO listing_rank_runs (slot, listings, moved) VALUES (:s, :n, :m) ON CONFLICT (slot) DO NOTHING"),
        {"s": slot, "n": len(positions), "m": moved},
    )
    return {"slot": slot, "listings": len(positions), "moved": moved, "top": order[:3]}
