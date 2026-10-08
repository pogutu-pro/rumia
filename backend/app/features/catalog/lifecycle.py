"""Listing lifecycle: allowed transitions, signed one-tap links, and the freshness sweep."""
import logging
import time
from typing import Any, Dict, Optional, Tuple

from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import BadRequestException, ConflictException, NotFoundException

logger = logging.getLogger(__name__)

# from-status -> statuses it may move to. Everything else is rejected.
TRANSITIONS: Dict[str, Tuple[str, ...]] = {
    "draft": ("in_review", "live", "archived"),
    "in_review": ("live", "draft", "removed"),
    "live": ("stale", "paused", "let", "removed", "in_review"),
    "stale": ("live", "paused", "let", "removed", "in_review"),
    "paused": ("live", "removed", "archived"),
    "let": ("live", "archived", "removed"),
    "removed": ("archived",),
    "archived": (),
}
PUBLIC_STATUSES = ("live", "stale", "paused", "let")  # pages that resolve for a shared link

ACTIONS = {"confirm": "live", "let": "let", "pause": "paused"}
ACTION_TTL_DAYS = 14


def make_action_token(property_id: str, action: str, ttl_days: int = ACTION_TTL_DAYS) -> str:
    """Signed, expiring link token for the one-tap 'still available / let / pause' messages."""
    if action not in ACTIONS:
        raise ValueError(f"unknown action {action!r}")
    secret = settings.AUTH_JWT_SECRET
    if len(secret) < 32:
        raise RuntimeError("AUTH_JWT_SECRET must be set to sign action links")
    return jwt.encode(
        {"typ": "prop-action", "pid": property_id, "act": action, "exp": int(time.time()) + ttl_days * 86400},
        secret, algorithm="HS256",
    )


def read_action_token(token: str) -> Tuple[str, str]:
    try:
        claims = jwt.decode(token, settings.AUTH_JWT_SECRET, algorithms=["HS256"])
    except JWTError as exc:
        raise BadRequestException("This link has expired or is not valid.") from exc
    if claims.get("typ") != "prop-action" or claims.get("act") not in ACTIONS:
        raise BadRequestException("This link is not valid.")
    return str(claims["pid"]), str(claims["act"])


async def get_status(db: AsyncSession, property_id: str) -> Tuple[str, str]:
    row = (
        await db.execute(text("SELECT status, name FROM properties WHERE id = CAST(:p AS uuid) FOR UPDATE"), {"p": property_id})
    ).first()
    if not row:
        raise NotFoundException("Property not found.")
    return row[0], row[1]


async def transition(
    db: AsyncSession,
    property_id: str,
    to_status: str,
    *,
    actor_kind: str,
    actor_id: Optional[str] = None,
    reason: Optional[str] = None,
) -> str:
    """Move a property to a new status if allowed, recording who did it and why."""
    current, _ = await get_status(db, property_id)
    if current == to_status:
        return current
    if to_status not in TRANSITIONS.get(current, ()):
        raise ConflictException(code="INVALID_TRANSITION", message=f"A {current} place cannot become {to_status}.")
    await db.execute(
        text(
            """
            UPDATE properties SET status = :s, updated_at = now(),
                   last_confirmed_at = CASE WHEN :s = 'live' THEN now() ELSE last_confirmed_at END,
                   published_at = CASE WHEN :s = 'live' AND published_at IS NULL THEN now() ELSE published_at END
            WHERE id = CAST(:p AS uuid)
            """
        ),
        {"s": to_status, "p": property_id},
    )
    await db.execute(
        text(
            """
            INSERT INTO property_status_history (property_id, from_status, to_status, actor_kind, actor_id, reason)
            VALUES (CAST(:p AS uuid), :f, :t, :ak, CAST(:ai AS uuid), :r)
            """
        ),
        {"p": property_id, "f": current, "t": to_status, "ak": actor_kind, "ai": actor_id, "r": reason},
    )
    # Mirror availability back to the legacy listing so old screens agree until they are removed.
    await db.execute(
        text(
            """
            UPDATE listings SET is_active = (:s IN ('live', 'stale', 'let')), is_full = (:s = 'let')
            WHERE id = (SELECT legacy_listing_id FROM properties WHERE id = CAST(:p AS uuid))
            """
        ),
        {"s": to_status, "p": property_id},
    )
    return to_status


async def confirm_available(db: AsyncSession, property_id: str, *, actor_kind: str, actor_id: Optional[str] = None) -> str:
    """The lister says it is still available: refresh freshness and keep the evidence."""
    current, _ = await get_status(db, property_id)
    if current in ("stale", "paused", "let"):
        await transition(db, property_id, "live", actor_kind=actor_kind, actor_id=actor_id, reason="confirmed available")
    elif current == "live":
        await db.execute(
            text("UPDATE properties SET last_confirmed_at = now(), updated_at = now() WHERE id = CAST(:p AS uuid)"),
            {"p": property_id},
        )
    else:
        raise ConflictException(code="INVALID_TRANSITION", message=f"A {current} place cannot be confirmed.")
    await db.execute(
        text(
            """
            INSERT INTO verification_evidence (subject, subject_id, kind, status, actor_id, source)
            VALUES ('property', CAST(:p AS uuid), 'availability_confirm', 'valid', CAST(:a AS uuid), :src)
            """
        ),
        {"p": property_id, "a": actor_id, "src": actor_kind},
    )
    await db.execute(
        text("UPDATE listings SET is_full = false WHERE id = (SELECT legacy_listing_id FROM properties WHERE id = CAST(:p AS uuid))"),
        {"p": property_id},
    )
    return "live"


async def freshness_sweep(db: AsyncSession) -> Dict[str, int]:
    """Daily: ask owners to reconfirm, then demote and finally pause what nobody confirms.

    Thresholds come from each market's config (days since last confirmation), defaults 10 / 14 / 21.
    Returns how many properties were reminded, made stale and paused.
    """
    from app.core.tasks.jobs import enqueue  # local import: jobs imports nothing from catalog

    cfg = """
        WITH cfg AS (
          SELECT m.id AS market_id,
                 coalesce((m.config->>'reconfirm_after_days')::int, 10) AS remind,
                 coalesce((m.config->>'stale_after_days')::int, 14)    AS stale,
                 coalesce((m.config->>'pause_after_days')::int, 21)    AS pause
          FROM markets m)
    """

    async def ids(status: str, column: str) -> list:
        rows = await db.execute(
            text(
                cfg
                + f"""
                SELECT p.id, coalesce(cfg.remind, 10) AS remind FROM properties p
                LEFT JOIN cfg ON cfg.market_id = p.market_id
                WHERE p.status = :s
                  AND p.last_confirmed_at < now() - make_interval(days => coalesce(cfg.{column}, :d))
                """
            ),
            {"s": status, "d": {"remind": 10, "stale": 14, "pause": 21}[column]},
        )
        return [(str(r[0]), int(r[1])) for r in rows.all()]

    paused = await ids("stale", "pause")
    for pid, _ in paused:
        await transition(db, pid, "paused", actor_kind="system", reason="not confirmed")

    stale = await ids("live", "stale")
    for pid, _ in stale:
        await transition(db, pid, "stale", actor_kind="system", reason="not confirmed")

    # Reminders go to live and stale places; one per reminder period per property.
    reminded = 0
    for status in ("live", "stale"):
        for pid, remind_days in await ids(status, "remind"):
            bucket = int(time.time() // 86400) // max(remind_days, 1)
            queued = await enqueue(db, "reconfirm_property", {"property_id": pid}, idempotency_key=f"reconfirm:{pid}:{bucket}")
            reminded += 1 if queued else 0
    return {"reminded": reminded, "stale": len(stale), "paused": len(paused)}
