from typing import Any, Dict, List, Optional, Set

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, NotFoundException
from app.core.permissions import AccessContext
from app.features.catalog import lifecycle


def market_filter(access: AccessContext, column: str = "p.market_id") -> tuple[str, Dict[str, Any]]:
    """SQL limiting rows to the markets this staff member may see (no limit for all-market staff)."""
    scope: Optional[Set[str]] = access.staff_markets
    if scope is None:
        return "TRUE", {}
    if not scope:
        return "FALSE", {}
    return f"{column} = ANY(CAST(:scope AS uuid[]))", {"scope": list(scope)}


async def queues(db: AsyncSession, access: AccessContext) -> Dict[str, Any]:
    """What needs a human, with how long the oldest item has waited."""
    f, params = market_filter(access)

    async def count_age(sql: str, p: Dict[str, Any]) -> Dict[str, Any]:
        row = (await db.execute(text(sql), {**params, **p})).one()
        return {"count": int(row[0]), "oldest_hours": round(float(row[1]), 1) if row[1] is not None else None}

    return {
        "review": await count_age(
            f"SELECT count(*), max(extract(epoch FROM now() - p.updated_at)) / 3600 FROM properties p WHERE p.status = 'in_review' AND {f}", {}),
        "reports": await count_age(
            f"""SELECT count(*), max(extract(epoch FROM now() - r.created_at)) / 3600 FROM reports r
                JOIN properties p ON p.id = r.property_id WHERE r.status = 'open' AND {f}""", {}),
        "stale": await count_age(
            f"SELECT count(*), max(extract(epoch FROM now() - p.last_confirmed_at)) / 3600 FROM properties p WHERE p.status = 'stale' AND {f}", {}),
        "unverified_busy": await count_age(
            f"""SELECT count(*), NULL FROM properties p WHERE p.status = 'live' AND {f}
                  AND NOT EXISTS (SELECT 1 FROM verification_evidence e WHERE e.subject = 'property' AND e.subject_id = p.id AND e.kind = 'site_visit')
                  AND (SELECT count(*) FROM inquiries i WHERE i.listing_id = p.legacy_listing_id AND i.created_at > now() - interval '30 days') >= 3""", {}),
    }


async def review_queue(db: AsyncSession, access: AccessContext, limit: int = 50) -> List[Dict[str, Any]]:
    f, params = market_filter(access)
    rows = (
        await db.execute(
            text(
                f"""
                SELECT p.id, p.slug, p.name, p.kind, p.updated_at, o.name AS org_name, o.standing,
                       (SELECT reason FROM property_status_history h WHERE h.property_id = p.id AND h.to_status = 'in_review'
                         ORDER BY h.at DESC LIMIT 1) AS reason,
                       (SELECT count(*) FROM reports r WHERE r.property_id = p.id AND r.status = 'open') AS open_reports,
                       (SELECT count(*) FROM media_assets a JOIN property_media pm ON pm.asset_id = a.id
                         WHERE pm.property_id = p.id AND a.content_hash IS NOT NULL
                           AND EXISTS (SELECT 1 FROM media_assets b JOIN property_media pm2 ON pm2.asset_id = b.id
                                       WHERE b.content_hash = a.content_hash AND pm2.property_id <> p.id)) AS duplicate_photos
                FROM properties p JOIN lister_orgs o ON o.id = p.org_id
                WHERE p.status = 'in_review' AND {f} ORDER BY p.updated_at LIMIT :limit
                """
            ),
            {**params, "limit": limit},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def decide_review(db: AsyncSession, property_id: str, decision: str, actor_id: str, note: Optional[str]) -> str:
    if decision == "approve":
        return await lifecycle.transition(db, property_id, "live", actor_kind="staff", actor_id=actor_id, reason=note or "approved")
    if decision == "request_changes":
        if not note:
            raise BadRequestException("Say what needs to change.")
        return await lifecycle.transition(db, property_id, "draft", actor_kind="staff", actor_id=actor_id, reason=note)
    if decision == "reject":
        if not note:
            raise BadRequestException("Give a reason for rejecting.")
        return await lifecycle.transition(db, property_id, "removed", actor_kind="staff", actor_id=actor_id, reason=note)
    raise BadRequestException("Unknown decision.")


async def open_reports(db: AsyncSession, access: AccessContext, limit: int = 50) -> List[Dict[str, Any]]:
    f, params = market_filter(access)
    rows = (
        await db.execute(
            text(
                f"""
                SELECT r.id, r.reason, r.details, r.priority, r.created_at, p.id AS property_id, p.slug, p.name, p.status,
                       (SELECT count(*) FROM reports r2 WHERE r2.property_id = p.id AND r2.reason = r.reason AND r2.status = 'open') AS same_reason_count
                FROM reports r JOIN properties p ON p.id = r.property_id
                WHERE r.status = 'open' AND {f} ORDER BY r.priority DESC, r.created_at LIMIT :limit
                """
            ),
            {**params, "limit": limit},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def resolve_report(db: AsyncSession, report_id: str, resolution: str, actor_id: str, note: Optional[str]) -> None:
    """dismiss | resolved | remove_listing | suspend_org"""
    row = (
        await db.execute(
            text("SELECT r.property_id, p.org_id, p.status FROM reports r JOIN properties p ON p.id = r.property_id WHERE r.id = CAST(:r AS uuid) AND r.status = 'open'"),
            {"r": report_id},
        )
    ).first()
    if not row:
        raise NotFoundException("Report not found or already handled.")
    pid, org_id, status = str(row[0]), str(row[1]), row[2]
    if resolution not in ("dismiss", "resolved", "remove_listing", "suspend_org"):
        raise BadRequestException("Unknown resolution.")
    if resolution == "remove_listing":
        if status != "removed":
            await lifecycle.transition(db, pid, "removed", actor_kind="staff", actor_id=actor_id, reason=note or "removed after report")
    elif resolution == "suspend_org":
        await db.execute(text("UPDATE lister_orgs SET status = 'suspended' WHERE id = CAST(:o AS uuid)"), {"o": org_id})
        if status in ("live", "stale", "paused", "let", "in_review"):
            await lifecycle.transition(db, pid, "removed", actor_kind="staff", actor_id=actor_id, reason=note or "organisation suspended")
    elif resolution == "dismiss" and status == "in_review":
        await lifecycle.transition(db, pid, "live", actor_kind="staff", actor_id=actor_id, reason="report dismissed")
    await db.execute(
        text(
            "UPDATE reports SET status = CASE WHEN :res = 'dismiss' THEN 'dismissed' ELSE 'resolved' END, resolution = :n, "
            "resolved_by = CAST(:a AS uuid), resolved_at = now() WHERE property_id = CAST(:p AS uuid) AND status = 'open'"
        ),
        {"res": resolution, "n": f"{resolution}: {note}" if note else resolution, "a": actor_id, "p": pid},
    )


async def stale_orgs(db: AsyncSession, access: AccessContext, limit: int = 50) -> List[Dict[str, Any]]:
    f, params = market_filter(access)
    rows = (
        await db.execute(
            text(
                f"""
                SELECT o.id, o.name, o.standing, count(*) FILTER (WHERE p.status IN ('stale','paused')) AS unconfirmed,
                       count(*) AS total, min(p.last_confirmed_at) AS oldest_confirmation
                FROM lister_orgs o JOIN properties p ON p.org_id = o.id
                WHERE o.status <> 'suspended' AND p.status IN ('live','stale','paused') AND {f}
                GROUP BY o.id HAVING count(*) FILTER (WHERE p.status IN ('stale','paused')) >= 2
                ORDER BY unconfirmed DESC LIMIT :limit
                """
            ),
            {**params, "limit": limit},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def record_visit(db: AsyncSession, property_id: str, actor_id: str, note: Optional[str]) -> None:
    exists = (await db.execute(text("SELECT 1 FROM properties WHERE id = CAST(:p AS uuid)"), {"p": property_id})).first()
    if not exists:
        raise NotFoundException("Property not found.")
    await db.execute(
        text(
            """
            INSERT INTO verification_evidence (subject, subject_id, kind, status, actor_id, expires_at, data)
            VALUES ('property', CAST(:p AS uuid), 'site_visit', 'valid', CAST(:a AS uuid), now() + interval '12 months',
                    jsonb_build_object('note', CAST(:n AS text)))
            """
        ),
        {"p": property_id, "a": actor_id, "n": note},
    )


async def market_health(db: AsyncSession, market_slug: str) -> Dict[str, Any]:
    """Supply (fresh live places) against demand (searches) per area, so leads know where to send scouts."""
    market = (await db.execute(text("SELECT id FROM markets WHERE slug = :s"), {"s": market_slug})).first()
    if not market:
        raise NotFoundException("Market not found.")
    m = str(market[0])
    summary = (
        await db.execute(
            text(
                """
                SELECT count(*) FILTER (WHERE status = 'live') AS live,
                       count(*) FILTER (WHERE status = 'stale') AS stale,
                       count(*) FILTER (WHERE status = 'live' AND last_confirmed_at > now() - interval '14 days') AS fresh,
                       count(*) FILTER (WHERE status IN ('live','stale','paused')) AS total
                FROM properties WHERE market_id = CAST(:m AS uuid)
                """
            ),
            {"m": m},
        )
    ).mappings().one()
    areas = (
        await db.execute(
            text(
                """
                SELECT pl.slug, pl.name,
                       count(p.id) FILTER (WHERE p.status = 'live') AS live,
                       count(p.id) FILTER (WHERE p.status = 'live' AND p.last_confirmed_at > now() - interval '14 days') AS fresh,
                       (SELECT count(*) FROM events e WHERE e.name IN ('search_performed','intent_set')
                          AND e.occurred_at > now() - interval '30 days' AND e.market = :slug
                          AND e.props->'places' ? pl.slug) AS searches_30d
                FROM places pl LEFT JOIN properties p ON p.place_id = pl.id
                WHERE pl.market_id = CAST(:m AS uuid) AND pl.kind = 'neighbourhood' GROUP BY pl.id ORDER BY searches_30d DESC, live DESC
                """
            ),
            {"m": m, "slug": market_slug},
        )
    ).mappings().all()
    total = max(int(summary["total"]), 1)
    return {
        "market": market_slug,
        "live": int(summary["live"]), "stale": int(summary["stale"]), "fresh": int(summary["fresh"]),
        "fresh_share": round(int(summary["fresh"]) / total, 3),
        "areas": [dict(a) | {"gap": int(a["searches_30d"]) > 0 and int(a["fresh"]) < 3} for a in areas],
    }
