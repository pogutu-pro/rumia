import base64
import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, NotFoundException
from app.features.catalog.service import days_ago_text
from app.features.discovery.query_parser import ParsedQuery, parse_query
from app.features.discovery.schemas import Relaxation, SearchCard, SearchFlags, SearchResponse

MAX_LIMIT = 50
MAX_OFFSET = 1000
MONTHLY = ("month", "semester", "week")
SORTS = ("best", "newest", "price_asc", "price_desc")


@dataclass
class SearchParams:
    market: Optional[str] = None
    q: str = ""
    mode: str = "monthly"
    places: List[str] = field(default_factory=list)
    kind: Optional[str] = None
    unit_kind: List[str] = field(default_factory=list)
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    amenities: List[str] = field(default_factory=list)
    has_video: Optional[bool] = None
    near: Optional[str] = None
    max_walk: Optional[int] = None
    gender: Optional[str] = None
    new_since: Optional[Any] = None  # datetime: only places published after this (alerts)
    sort: str = "best"
    limit: int = 20
    offset: int = 0

    def applied(self) -> Dict[str, Any]:
        d = {k: v for k, v in self.__dict__.items() if v not in (None, [], "", False) and k not in ("limit", "offset")}
        return d


def encode_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(json.dumps({"o": offset}).encode()).decode()


def decode_cursor(cursor: Optional[str]) -> int:
    if not cursor:
        return 0
    try:
        offset = int(json.loads(base64.urlsafe_b64decode(cursor.encode()))["o"])
    except Exception as exc:
        raise BadRequestException("Invalid cursor.") from exc
    if not 0 <= offset <= MAX_OFFSET:
        raise BadRequestException("Invalid cursor.")
    return offset


async def _market(db: AsyncSession, slug: Optional[str]) -> Tuple[str, str]:
    row = (
        await db.execute(
            text("SELECT id, slug FROM markets WHERE status IN ('pilot','live') AND (CAST(:s AS text) IS NULL OR slug = CAST(:s AS text)) ORDER BY (status = 'live') DESC, created_at LIMIT 1"),
            {"s": slug},
        )
    ).first()
    if not row:
        raise NotFoundException("Market not found.")
    return str(row[0]), row[1]


async def vocab(db: AsyncSession, market_id: str) -> Tuple[list, list]:
    places = [dict(r) for r in (await db.execute(text("SELECT slug, name, aliases FROM places WHERE market_id = CAST(:m AS uuid)"), {"m": market_id})).mappings().all()]
    landmarks = [dict(r) for r in (await db.execute(text("SELECT slug, name, aliases FROM landmarks WHERE market_id = CAST(:m AS uuid)"), {"m": market_id})).mappings().all()]
    return places, landmarks


def merge_parsed(p: SearchParams, parsed: ParsedQuery) -> SearchParams:
    """Explicit filters win over what was inferred from the text."""
    p.mode = p.mode if p.mode == "nightly" else (parsed.mode or p.mode)
    p.max_price = p.max_price if p.max_price is not None else parsed.max_price
    p.min_price = p.min_price if p.min_price is not None else parsed.min_price
    p.unit_kind = p.unit_kind or parsed.unit_kind
    p.kind = p.kind or parsed.kind
    p.amenities = p.amenities or parsed.amenities
    p.places = p.places or parsed.places
    p.near = p.near or parsed.landmark
    p.q = parsed.text
    return p


def _build(p: SearchParams, market_id: str) -> Tuple[str, str, Dict[str, Any]]:
    """(property-level WHERE, unit-level WHERE, bound parameters) shared by counting and fetching."""
    periods = ("night",) if p.mode == "nightly" else MONTHLY
    params: Dict[str, Any] = {"market": market_id, "periods": list(periods), "near_slug": p.near}
    where = ["p.market_id = CAST(:market AS uuid)", "p.status IN ('live', 'stale')"]
    unit_where = ["u.price_period = ANY(:periods)", "u.count_available > 0"]

    if p.places:
        where.append("pl.slug = ANY(:places)")
        params["places"] = p.places
    if p.kind:
        where.append("p.kind = :kind")
        params["kind"] = p.kind
    if p.unit_kind:
        unit_where.append("u.unit_kind = ANY(:unit_kind)")
        params["unit_kind"] = p.unit_kind
    if p.min_price is not None:
        unit_where.append("u.price_amount >= :min_price")
        params["min_price"] = p.min_price
    if p.max_price is not None:
        unit_where.append("u.price_amount <= :max_price")
        params["max_price"] = p.max_price
    if p.gender in ("women", "men"):
        unit_where.append("u.gender_policy IN ('any', :gender)")
        params["gender"] = p.gender
    for i, amenity in enumerate(p.amenities):
        key = f"am{i}"
        where.append(f"(:{key} = ANY(p.amenities) OR :{key} = ANY(p.included_utilities))")
        params[key] = amenity
    if p.has_video:
        where.append("EXISTS (SELECT 1 FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id WHERE pm.property_id = p.id AND a.kind = 'video')")
    if p.near:
        where.append("nd.walk_min IS NOT NULL")
        if p.max_walk:
            where.append("nd.walk_min <= :max_walk")
            params["max_walk"] = p.max_walk
    if p.new_since is not None:
        where.append("p.published_at > :new_since")
        params["new_since"] = p.new_since
    if p.q:
        params["q"] = p.q
        params["q_like"] = f"%{p.q}%"
        where.append("(p.name ILIKE :q_like OR pl.name ILIKE :q_like OR similarity(p.name, :q) > 0.3 OR p.address_hint ILIKE :q_like)")
    return " AND ".join(where), " AND ".join(unit_where), params


JOINS = """
    LEFT JOIN places pl ON pl.id = p.place_id
    LEFT JOIN landmarks lm ON lm.market_id = p.market_id AND lm.slug = CAST(:near_slug AS text)
    LEFT JOIN property_landmark_distances nd ON nd.property_id = p.id AND nd.landmark_id = lm.id
"""


async def search(db: AsyncSession, p: SearchParams, *, with_relaxations: bool = True) -> SearchResponse:
    market_id, market_slug = await _market(db, p.market)
    places, landmarks = await vocab(db, market_id)
    parsed = parse_query(p.q, places, landmarks) if p.q else ParsedQuery()
    p = merge_parsed(p, parsed)
    p.market = market_slug
    p.sort = p.sort if p.sort in SORTS else "best"
    p.limit = max(1, min(p.limit, MAX_LIMIT))

    total, items = await _run(db, p, market_id)
    relax: List[Relaxation] = []
    if with_relaxations and total < 5:
        relax = await _relaxations(db, p, market_id, total)
    return SearchResponse(
        items=items, total=total,
        next_cursor=encode_cursor(p.offset + p.limit) if p.offset + p.limit < min(total, MAX_OFFSET + p.limit) else None,
        chips=parsed.chips, relaxations=relax, applied=p.applied(),
    )


ORDER = {
    "best": "score DESC, p.published_at DESC NULLS LAST, p.id",
    "newest": "p.published_at DESC NULLS LAST, p.id",
    "price_asc": "from_price ASC, p.id",
    "price_desc": "from_price DESC, p.id",
}


async def _run(db: AsyncSession, p: SearchParams, market_id: str) -> Tuple[int, List[SearchCard]]:
    where, unit_where, params = _build(p, market_id)
    count = (
        await db.execute(
            text(
                f"""SELECT count(*) FROM properties p {JOINS}
                    WHERE {where} AND EXISTS (SELECT 1 FROM property_units u WHERE u.property_id = p.id AND {unit_where})"""
            ),
            params,
        )
    ).scalar_one()
    if count == 0:
        return 0, []

    params.update({"limit": p.limit, "offset": p.offset, "walk_cap": float(p.max_walk or 30)})
    rows = (
        await db.execute(
            text(
                f"""
                SELECT p.id, p.legacy_listing_id, p.slug, p.name, p.kind, p.status, p.lat, p.lng, p.last_confirmed_at, p.published_at, p.quality_score,
                       pl.name AS place_name,
                       u.price_amount AS from_price, u.price_period, u.unit_kind,
                       CASE WHEN u.deposit_amount IS NOT NULL THEN u.price_amount + u.deposit_amount END AS move_in_total,
                       nd.walk_min, coalesce(lm.features->>'short_name', lm.name) AS walk_to,
                       (SELECT a.url FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id
                         WHERE pm.property_id = p.id AND a.kind = 'image' AND a.status = 'ready'
                         ORDER BY pm.is_cover DESC, pm.position LIMIT 1) AS cover_url,
                       (SELECT a.blur_data_url FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id
                         WHERE pm.property_id = p.id AND a.kind = 'image' AND a.status = 'ready'
                         ORDER BY pm.is_cover DESC, pm.position LIMIT 1) AS cover_blur,
                       EXISTS (SELECT 1 FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id WHERE pm.property_id = p.id AND a.kind = 'video') AS has_video,
                       EXISTS (SELECT 1 FROM verification_evidence e WHERE e.subject = 'property' AND e.subject_id = p.id AND e.kind = 'site_visit' AND e.status = 'valid') AS visited,
                       EXISTS (SELECT 1 FROM verification_evidence e WHERE e.subject = 'property' AND e.subject_id = p.id AND e.kind = 'registry_match' AND e.status = 'valid') AS registry,
                       (SELECT max(e.observed_at) FROM verification_evidence e WHERE e.subject = 'property' AND e.subject_id = p.id AND e.kind = 'availability_confirm') AS confirmed_at,
                       (
                         0.30 * CASE WHEN p.status = 'stale' THEN 0.25
                                     WHEN p.last_confirmed_at > now() - interval '7 days' THEN 1.0
                                     WHEN p.last_confirmed_at > now() - interval '14 days' THEN 0.7 ELSE 0.5 END
                       + 0.25 * (p.quality_score / 100.0)
                       + 0.20 * LEAST(1.0, coalesce((SELECT count(*) FROM events ev WHERE ev.name = 'property_opened'
                                    AND ev.occurred_at > now() - interval '7 days'
                                    AND ev.listing_id IN (p.id, p.legacy_listing_id)), 0) / 20.0)
                       + 0.10 * CASE WHEN p.published_at > now() - interval '7 days' THEN 1.0 ELSE 0 END
                       + 0.15 * (CASE WHEN nd.walk_min IS NOT NULL THEN GREATEST(0.0, 1 - nd.walk_min / :walk_cap) ELSE 0.5 END)
                       ) AS score
                FROM properties p
                JOIN LATERAL (
                    SELECT * FROM property_units u
                    WHERE u.property_id = p.id AND {unit_where}
                    ORDER BY u.price_amount LIMIT 1
                ) u ON true
                {JOINS}
                WHERE {where}
                ORDER BY {ORDER[p.sort]}
                LIMIT :limit OFFSET :offset
                """
            ),
            params,
        )
    ).mappings().all()

    cards = []
    for r in rows:
        freshness = None
        if r["status"] == "stale":
            freshness = "Not confirmed recently"
        elif r["confirmed_at"]:
            freshness = f"Confirmed {days_ago_text(r['confirmed_at'])}"
        reason = None
        if r["walk_min"] is not None and r["walk_to"]:
            reason = f"{r['walk_min']} min walk to {r['walk_to']}"
        elif r["confirmed_at"] and (r["status"] == "live"):
            reason = freshness
        elif r["published_at"] and (r["last_confirmed_at"] or r["published_at"]):
            from datetime import datetime, timedelta, timezone

            if r["published_at"] > datetime.now(timezone.utc) - timedelta(days=7):
                reason = "New this week"
        cards.append(
            SearchCard(
                id=str(r["id"]), listing_id=str(r["legacy_listing_id"]) if r["legacy_listing_id"] else None,
                slug=r["slug"], name=r["name"], kind=r["kind"], status=r["status"], place_name=r["place_name"],
                cover_url=r["cover_url"], cover_blur=r["cover_blur"], from_price=float(r["from_price"]), price_period=r["price_period"],
                unit_kind=r["unit_kind"], move_in_total=float(r["move_in_total"]) if r["move_in_total"] is not None else None,
                walk_min=r["walk_min"], walk_to=r["walk_to"], freshness=freshness,
                flags=SearchFlags(visited=r["visited"], registry=r["registry"], has_video=r["has_video"]), reason=reason,
                lat=float(r["lat"]) if r["lat"] is not None else None, lng=float(r["lng"]) if r["lng"] is not None else None,
            )
        )
    return int(count), cards


async def _relaxations(db: AsyncSession, p: SearchParams, market_id: str, current_total: int) -> List[Relaxation]:
    """When few places match, say which single change would bring more."""
    import copy

    options: List[Relaxation] = []

    def variant(**changes):
        v = copy.copy(p)
        v.places, v.unit_kind, v.amenities = list(p.places), list(p.unit_kind), list(p.amenities)
        for k, val in changes.items():
            setattr(v, k, val)
        v.offset, v.limit = 0, 1
        return v

    candidates: List[Tuple[str, Dict[str, Any]]] = []
    if p.max_price:
        raised = round(p.max_price * 1.2 / 500) * 500
        candidates.append((f"Raise the budget to KSh {int(raised):,}", {"max_price": raised}))
    if p.places:
        candidates.append(("Include nearby areas", {"places": []}))
    for amenity in p.amenities[:1]:
        candidates.append((f"Without {amenity}", {"amenities": [a for a in p.amenities if a != amenity]}))
    if p.unit_kind:
        candidates.append(("Any room type", {"unit_kind": []}))
    for label, change in candidates:
        total, _ = await _run(db, variant(**change), market_id)
        if total > current_total:
            options.append(Relaxation(label=f"{label} → {total} places", count=total, change={k: v for k, v in change.items()}))
    return sorted(options, key=lambda r: -r.count)[:3]


async def similar(db: AsyncSession, slug: str, limit: int = 6) -> List[SearchCard]:
    ref = (
        await db.execute(
            text(
                """
                SELECT p.id, p.market_id, p.kind, p.place_id,
                       (SELECT min(price_amount) FROM property_units WHERE property_id = p.id AND price_period IN ('month','semester','week','night')) AS price,
                       (SELECT price_period FROM property_units WHERE property_id = p.id ORDER BY price_amount LIMIT 1) AS period
                FROM properties p WHERE p.slug = :s
                """
            ),
            {"s": slug},
        )
    ).mappings().first()
    if not ref or ref["price"] is None:
        raise NotFoundException("Place not found.")
    price = float(ref["price"])
    market_id = str(ref["market_id"]) if ref["market_id"] else None
    if not market_id:
        return []
    sp = SearchParams(market=None, mode="nightly" if ref["period"] == "night" else "monthly", kind=ref["kind"],
                      min_price=price * 0.65, max_price=price * 1.35, sort="best", limit=limit + 1)
    sql_market = (await db.execute(text("SELECT slug FROM markets WHERE id = :m"), {"m": ref["market_id"]})).scalar_one()
    sp.market = sql_market
    _, cards = await _run(db, sp, market_id)
    same_place = {str(r[0]) for r in (await db.execute(text("SELECT id FROM properties WHERE place_id = :p"), {"p": ref["place_id"]})).all()} if ref["place_id"] else set()
    cards = [c for c in cards if c.slug != slug]
    cards.sort(key=lambda c: (c.id not in same_place, abs((c.from_price or price) - price)))
    return cards[:limit]


CARD_SELECT = """
    SELECT p.id, p.legacy_listing_id, p.slug, p.name, p.kind, p.status, p.lat, p.lng, p.last_confirmed_at, p.published_at,
           pl.name AS place_name,
           u.price_amount AS from_price, u.price_period, u.unit_kind,
           CASE WHEN u.deposit_amount IS NOT NULL THEN u.price_amount + u.deposit_amount END AS move_in_total,
           (SELECT a.url FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id
             WHERE pm.property_id = p.id AND a.kind = 'image' AND a.status = 'ready'
             ORDER BY pm.is_cover DESC, pm.position LIMIT 1) AS cover_url,
           (SELECT a.blur_data_url FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id
             WHERE pm.property_id = p.id AND a.kind = 'image' AND a.status = 'ready'
             ORDER BY pm.is_cover DESC, pm.position LIMIT 1) AS cover_blur,
           EXISTS (SELECT 1 FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id WHERE pm.property_id = p.id AND a.kind = 'video') AS has_video,
           EXISTS (SELECT 1 FROM verification_evidence e WHERE e.subject = 'property' AND e.subject_id = p.id AND e.kind = 'site_visit' AND e.status = 'valid') AS visited,
           EXISTS (SELECT 1 FROM verification_evidence e WHERE e.subject = 'property' AND e.subject_id = p.id AND e.kind = 'registry_match' AND e.status = 'valid') AS registry,
           (SELECT max(e.observed_at) FROM verification_evidence e WHERE e.subject = 'property' AND e.subject_id = p.id AND e.kind = 'availability_confirm') AS confirmed_at
    FROM properties p
    LEFT JOIN places pl ON pl.id = p.place_id
    JOIN LATERAL (SELECT * FROM property_units WHERE property_id = p.id ORDER BY (count_available > 0) DESC, price_amount LIMIT 1) u ON true
"""


def _plain_card(r) -> SearchCard:
    freshness = None
    if r["status"] == "stale":
        freshness = "Not confirmed recently"
    elif r["status"] == "let":
        freshness = "Let"
    elif r["status"] == "paused":
        freshness = "No longer available"
    elif r["confirmed_at"]:
        freshness = f"Confirmed {days_ago_text(r['confirmed_at'])}"
    return SearchCard(
        id=str(r["id"]), listing_id=str(r["legacy_listing_id"]) if r["legacy_listing_id"] else None,
        slug=r["slug"], name=r["name"], kind=r["kind"], status=r["status"], place_name=r["place_name"],
        cover_url=r["cover_url"], cover_blur=r["cover_blur"], from_price=float(r["from_price"]), price_period=r["price_period"],
        unit_kind=r["unit_kind"], move_in_total=float(r["move_in_total"]) if r["move_in_total"] is not None else None,
        freshness=freshness, flags=SearchFlags(visited=r["visited"], registry=r["registry"], has_video=r["has_video"]),
        lat=float(r["lat"]) if r["lat"] is not None else None, lng=float(r["lng"]) if r["lng"] is not None else None,
    )


async def cards_for_listing_ids(db: AsyncSession, listing_ids: List[str]) -> List[SearchCard]:
    """Cards for saved places, in the order given, including let/paused ones (so a saved place that was taken says so)."""
    import uuid as _uuid

    clean = []
    for i in listing_ids[:50]:
        try:
            clean.append(str(_uuid.UUID(i)))
        except ValueError:
            continue
    if not clean:
        return []
    rows = (
        await db.execute(
            text(CARD_SELECT + " WHERE p.legacy_listing_id = ANY(CAST(:ids AS uuid[])) AND p.status IN ('live','stale','paused','let')"),
            {"ids": clean},
        )
    ).mappings().all()
    legacy = {
        str(r[0]): str(r[1])
        for r in (await db.execute(text("SELECT id, legacy_listing_id FROM properties WHERE legacy_listing_id = ANY(CAST(:ids AS uuid[]))"), {"ids": clean})).all()
    }
    by_listing = {legacy_id: pid for pid, legacy_id in legacy.items()}
    order = {pid: i for i, lid in enumerate(clean) if (pid := by_listing.get(lid))}
    return sorted((_plain_card(r) for r in rows), key=lambda c: order.get(c.id, 999))


async def org_profile(db: AsyncSession, slug: str) -> Dict[str, Any]:
    org = (
        await db.execute(text("SELECT id, name, slug, created_at FROM lister_orgs WHERE slug = :s AND status <> 'suspended'"), {"s": slug})
    ).mappings().first()
    if not org:
        raise NotFoundException("Lister not found.")
    rows = (
        await db.execute(text(CARD_SELECT + " WHERE p.org_id = :o AND p.status IN ('live','stale') ORDER BY p.published_at DESC NULLS LAST LIMIT 50"), {"o": org["id"]})
    ).mappings().all()
    stats = (
        await db.execute(
            text(
                """
                SELECT count(*) FILTER (WHERE i.replied IS NOT NULL) AS answered,
                       count(*) FILTER (WHERE i.replied = 'yes') AS replied_yes
                FROM inquiries i JOIN properties p ON p.legacy_listing_id = i.listing_id WHERE p.org_id = :o
                """
            ),
            {"o": org["id"]},
        )
    ).mappings().one()
    answered = int(stats["answered"])
    return {
        "name": org["name"], "slug": org["slug"], "since_year": org["created_at"].year,
        "places": [_plain_card(r) for r in rows],
        # Shown only once there are enough answers to mean something.
        "reply_rate": round(int(stats["replied_yes"]) / answered, 2) if answered >= 5 else None,
    }
