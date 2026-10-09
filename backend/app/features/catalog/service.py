import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundException
from app.core.geo import haversine_m, walk_minutes
from app.features.catalog.lifecycle import PUBLIC_STATUSES
from app.features.catalog.schemas import (
    FactRead, LandmarkDistance, MediaRead, OrgBrief, PropertyRead, UnitRead,
)

logger = logging.getLogger(__name__)


def days_ago_text(moment: Optional[datetime], now: Optional[datetime] = None) -> str:
    if not moment:
        return ""
    now = now or datetime.now(timezone.utc)
    days = max(0, (now - moment).days)
    if days == 0:
        return "today"
    if days == 1:
        return "yesterday"
    if days < 14:
        return f"{days} days ago"
    if days < 60:
        return f"{days // 7} weeks ago"
    return f"{days // 30} months ago"


def build_facts(evidence: List[Dict[str, Any]], last_confirmed_at: Optional[datetime], status: str) -> List[FactRead]:
    """Plain, dated sentences. Only evidence that exists is shown; nothing is implied."""
    facts: List[FactRead] = []
    by_kind: Dict[str, Dict[str, Any]] = {}
    for e in sorted(evidence, key=lambda e: e["observed_at"]):
        by_kind[e["kind"]] = e
    confirm = by_kind.get("availability_confirm")
    if status in ("live", "stale") and confirm:
        when = days_ago_text(confirm["observed_at"])
        if status == "stale":
            facts.append(FactRead(kind="availability", text=f"Not confirmed recently. Last confirmed {when}. Ask before you visit.",
                                  observed_at=confirm["observed_at"]))
        else:
            facts.append(FactRead(kind="availability", text=f"Available, confirmed by the owner {when}", observed_at=confirm["observed_at"]))
    elif status == "stale":
        facts.append(FactRead(kind="availability", text="Not confirmed recently. Ask before you visit."))
    visit = by_kind.get("site_visit")
    if visit and visit["status"] == "valid":
        facts.append(FactRead(kind="visit", text=f"Visited by Rumia on {visit['observed_at']:%-d %b %Y}", observed_at=visit["observed_at"]))
    registry = by_kind.get("registry_match")
    if registry and registry["status"] == "valid":
        source = (registry.get("source") or "an official").strip()
        label = source if source.lower().endswith("register") else f"{source} register"
        facts.append(FactRead(kind="registry", text=f"In {label}", observed_at=registry["observed_at"]))
    return facts


async def _sync_registry_evidence(db: AsyncSession, listing_id: str, property_id: str) -> None:
    """Make the property's registry-match evidence follow the listing's `verified` flag in both directions
    (the SQL copy only ever adds it), so an admin un-verify also removes the trust badge."""
    params = {"l": str(listing_id), "p": property_id}
    await db.execute(
        text(
            """
            UPDATE verification_evidence e
            SET status = CASE WHEN l.verified AND l.verified_source IS NOT NULL THEN 'valid' ELSE 'revoked' END,
                source = coalesce(l.verified_source, e.source),
                observed_at = CASE WHEN l.verified AND e.status <> 'valid' THEN now() ELSE e.observed_at END
            FROM listings l
            WHERE l.id = CAST(:l AS uuid) AND e.subject = 'property' AND e.subject_id = CAST(:p AS uuid)
              AND e.kind = 'registry_match'
              AND e.status <> CASE WHEN l.verified AND l.verified_source IS NOT NULL THEN 'valid' ELSE 'revoked' END
            """
        ),
        params,
    )
    await db.execute(
        text(
            """
            INSERT INTO verification_evidence (subject, subject_id, kind, status, observed_at, source)
            SELECT 'property', CAST(:p AS uuid), 'registry_match', 'valid', coalesce(l.verified_date::timestamptz, now()), l.verified_source
            FROM listings l
            WHERE l.id = CAST(:l AS uuid) AND coalesce(l.verified, false) AND l.verified_source IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM verification_evidence e WHERE e.subject = 'property'
                              AND e.subject_id = CAST(:p AS uuid) AND e.kind = 'registry_match')
            """
        ),
        params,
    )


async def project_listing(db: AsyncSession, listing_id: str) -> Optional[str]:
    """Copy a legacy listing into the property model. Never breaks the legacy write that triggered it."""
    try:
        async with db.begin_nested():
            row = (await db.execute(text("SELECT project_listing(CAST(:l AS uuid))"), {"l": str(listing_id)})).first()
            prop = str(row[0]) if row and row[0] else None
            if prop:
                await _sync_registry_evidence(db, listing_id, prop)
            return prop
    except Exception:
        logger.exception("could not project listing %s into the property model", listing_id)
        return None


async def mark_removed_for_listing(db: AsyncSession, listing_id: str) -> None:
    """A deleted listing must not live on as a public property."""
    await db.execute(
        text(
            "UPDATE properties SET status = 'removed', updated_at = now() "
            "WHERE legacy_listing_id = CAST(:l AS uuid) AND status <> 'removed'"
        ),
        {"l": str(listing_id)},
    )


async def get_property_read(db: AsyncSession, slug: str) -> PropertyRead:
    prop = (
        await db.execute(
            text(
                """
                SELECT p.*, m.slug AS market_slug, pl.slug AS place_slug, pl.name AS place_name,
                       o.name AS org_name, o.slug AS org_slug
                FROM properties p
                LEFT JOIN markets m ON m.id = p.market_id
                LEFT JOIN places pl ON pl.id = p.place_id
                LEFT JOIN lister_orgs o ON o.id = p.org_id
                WHERE p.slug = :s
                """
            ),
            {"s": slug},
        )
    ).mappings().first()
    if not prop or prop["status"] not in PUBLIC_STATUSES:
        raise NotFoundException("This place is not listed.")
    pid = str(prop["id"])

    units = (
        await db.execute(
            text("SELECT * FROM property_units WHERE property_id = CAST(:p AS uuid) ORDER BY price_amount"), {"p": pid}
        )
    ).mappings().all()
    media = (
        await db.execute(
            text(
                """
                SELECT a.id, a.kind, a.source, a.url, a.external_id, a.variants, a.width, a.height, a.blur_data_url,
                       pm.room_tag, pm.position, pm.is_cover
                FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id
                WHERE pm.property_id = CAST(:p AS uuid) AND a.status = 'ready' ORDER BY pm.position
                """
            ),
            {"p": pid},
        )
    ).mappings().all()
    evidence = [
        dict(r)
        for r in (
            await db.execute(
                text("SELECT kind, status, observed_at, source FROM verification_evidence WHERE subject = 'property' AND subject_id = CAST(:p AS uuid)"),
                {"p": pid},
            )
        ).mappings().all()
    ]
    landmarks = (
        await db.execute(
            text(
                """
                SELECT l.slug, l.name, l.kind, d.walk_min FROM property_landmark_distances d
                JOIN landmarks l ON l.id = d.landmark_id WHERE d.property_id = CAST(:p AS uuid) ORDER BY d.walk_min LIMIT 4
                """
            ),
            {"p": pid},
        )
    ).mappings().all()

    unit_reads = []
    for u in units:
        price = float(u["price_amount"])
        deposit = float(u["deposit_amount"]) if u["deposit_amount"] is not None else None
        unit_reads.append(
            UnitRead(
                id=str(u["id"]), unit_kind=u["unit_kind"], label=u["label"], price_amount=price, price_period=u["price_period"],
                deposit_amount=deposit, move_in_total=(price + deposit) if deposit else None,
                count_available=u["count_available"], bathroom=u["bathroom"], furnished=u["furnished"], sharing=u["sharing"],
                bedrooms=u["bedrooms"], bathrooms=u["bathrooms"], gender_policy=u["gender_policy"],
                min_stay=u["min_stay"], max_guests=u["max_guests"],
            )
        )
    available = [u for u in unit_reads if u.count_available > 0] or unit_reads
    cheapest = min(available, key=lambda u: u.price_amount) if available else None

    return PropertyRead(
        id=pid, listing_id=str(prop["legacy_listing_id"]) if prop["legacy_listing_id"] else None,
        slug=prop["slug"], name=prop["name"], kind=prop["kind"], status=prop["status"],
        market_slug=prop["market_slug"], place_slug=prop["place_slug"], place_name=prop["place_name"],
        lat=float(prop["lat"]) if prop["lat"] is not None else None,
        lng=float(prop["lng"]) if prop["lng"] is not None else None,
        location_precision=prop["location_precision"], address_hint=prop["address_hint"], description=prop["description"],
        amenities=list(prop["amenities"] or []), included_utilities=list(prop["included_utilities"] or []),
        house_rules=dict(prop["house_rules"] or {}), audience=list(prop["audience"] or []), tier=prop["tier"],
        from_price=cheapest.price_amount if cheapest else None,
        from_price_period=cheapest.price_period if cheapest else None,
        last_confirmed_at=prop["last_confirmed_at"],
        facts=build_facts(evidence, prop["last_confirmed_at"], prop["status"]),
        units=unit_reads,
        media=[MediaRead(id=str(m["id"]), kind=m["kind"], source=m["source"], url=m["url"], external_id=m["external_id"],
                         variants=dict(m["variants"] or {}), width=m["width"], height=m["height"],
                         blur_data_url=m["blur_data_url"], room_tag=m["room_tag"], position=m["position"], is_cover=m["is_cover"])
               for m in media],
        landmarks=[LandmarkDistance(slug=l["slug"], name=l["name"], kind=l["kind"], walk_min=l["walk_min"]) for l in landmarks],
        org=OrgBrief(name=prop["org_name"], slug=prop["org_slug"]) if prop["org_name"] else None,
    )


# ── Derived data ────────────────────────────────────────────────────────────────────────────────

def compute_quality(*, photos: int, has_video: bool, has_registry: bool, has_visit: bool, confirmed_days: Optional[float],
                    description_len: int, has_location: bool, has_deposit_info: bool) -> float:
    """0–100. Rewards complete, recent, evidenced listings. Deterministic and explainable."""
    score = min(photos, 8) / 8 * 30  # up to 30 for 8+ photos
    score += 12 if has_video else 0
    score += 10 if has_registry else 0
    score += 15 if has_visit else 0
    if confirmed_days is not None:
        score += max(0.0, 20 * (1 - min(confirmed_days, 30) / 30))  # 20 when confirmed today, 0 at 30+ days
    score += 5 if description_len >= 80 else 0
    score += 4 if has_location else 0
    score += 4 if has_deposit_info else 0
    return round(min(score, 100.0), 2)


def tier_for(price: float, cohort_prices: List[float]) -> str:
    """value / standard / premium from the price position within same-kind peers (needs 20+ peers)."""
    if len(cohort_prices) < 20:
        return "standard"
    rank = sum(1 for p in cohort_prices if p <= price) / len(cohort_prices)
    if rank >= 0.85:
        return "premium"
    if rank <= 0.30:
        return "value"
    return "standard"


async def refresh_scores(db: AsyncSession) -> int:
    """Recompute quality_score and tier for every live/stale property. Returns rows updated."""
    rows = (
        await db.execute(
            text(
                """
                SELECT p.id, p.kind, p.market_id, p.lat, p.lng, length(coalesce(p.description, '')) AS dlen,
                       extract(epoch FROM (now() - p.last_confirmed_at)) / 86400 AS conf_days,
                       (SELECT count(*) FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id
                         WHERE pm.property_id = p.id AND a.kind = 'image' AND a.status = 'ready') AS photos,
                       EXISTS (SELECT 1 FROM property_media pm JOIN media_assets a ON a.id = pm.asset_id
                                WHERE pm.property_id = p.id AND a.kind = 'video' AND a.status = 'ready') AS has_video,
                       EXISTS (SELECT 1 FROM verification_evidence e WHERE e.subject = 'property' AND e.subject_id = p.id
                                AND e.kind = 'registry_match' AND e.status = 'valid') AS has_registry,
                       EXISTS (SELECT 1 FROM verification_evidence e WHERE e.subject = 'property' AND e.subject_id = p.id
                                AND e.kind = 'site_visit' AND e.status = 'valid') AS has_visit,
                       (SELECT min(price_amount) FROM property_units u WHERE u.property_id = p.id AND u.price_period IN ('month', 'semester')) AS min_price,
                       EXISTS (SELECT 1 FROM property_units u WHERE u.property_id = p.id AND u.deposit_amount IS NOT NULL) AS has_deposit
                FROM properties p WHERE p.status IN ('live', 'stale')
                """
            )
        )
    ).mappings().all()
    cohorts: Dict[tuple, List[float]] = {}
    for r in rows:
        if r["min_price"] is not None:
            cohorts.setdefault((r["market_id"], r["kind"]), []).append(float(r["min_price"]))
    for r in rows:
        quality = compute_quality(
            photos=int(r["photos"]), has_video=bool(r["has_video"]), has_registry=bool(r["has_registry"]),
            has_visit=bool(r["has_visit"]), confirmed_days=float(r["conf_days"]) if r["conf_days"] is not None else None,
            description_len=int(r["dlen"]), has_location=r["lat"] is not None, has_deposit_info=bool(r["has_deposit"]),
        )
        tier = tier_for(float(r["min_price"]), cohorts[(r["market_id"], r["kind"])]) if r["min_price"] is not None else None
        await db.execute(
            text("UPDATE properties SET quality_score = :q, tier = :t WHERE id = :i"),
            {"q": quality, "t": tier, "i": r["id"]},
        )
    return len(rows)


async def refresh_distances(db: AsyncSession, property_id: Optional[str] = None) -> int:
    """Walking distance from each located property to the landmarks of its market."""
    where = "AND p.id = CAST(:p AS uuid)" if property_id else ""
    rows = (
        await db.execute(
            text(
                f"""
                SELECT p.id AS pid, p.lat AS plat, p.lng AS plng, l.id AS lid, l.lat AS llat, l.lng AS llng
                FROM properties p JOIN landmarks l ON l.market_id = p.market_id
                WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL {where}
                """
            ),
            {"p": property_id} if property_id else {},
        )
    ).mappings().all()
    for r in rows:
        plat, plng, llat, llng = float(r["plat"]), float(r["plng"]), float(r["llat"]), float(r["llng"])
        metres = int(haversine_m(plat, plng, llat, llng))
        await db.execute(
            text(
                """
                INSERT INTO property_landmark_distances (property_id, landmark_id, straight_m, walk_min)
                VALUES (:p, :l, :m, :w)
                ON CONFLICT (property_id, landmark_id) DO UPDATE SET straight_m = EXCLUDED.straight_m, walk_min = EXCLUDED.walk_min
                """
            ),
            {"p": r["pid"], "l": r["lid"], "m": metres, "w": walk_minutes(plat, plng, llat, llng)},
        )
    return len(rows)
