from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, NotFoundException
from app.features.catalog.lifecycle import PUBLIC_STATUSES, transition

REASONS = ("not_available", "wrong_price", "scam", "wrong_location", "other")
PRIORITY = {"scam": 2, "not_available": 1}


async def submit_report(
    db: AsyncSession, slug: str, reason: str, details: Optional[str], device_id: Optional[str], user_id: Optional[str]
) -> str:
    """Record a report and apply the automatic rules.

    * 2+ different reporters say "not available" within 14 days -> the place becomes stale and the owner is asked
      to reconfirm.
    * 2+ different reporters say "scam" within 14 days -> the place is held for review (hidden until a reviewer decides).
    """
    if reason not in REASONS:
        raise BadRequestException("Unknown report reason.")
    if not device_id and not user_id:
        raise BadRequestException("A device id (X-Device-Id) or a signed-in session is required to report.")
    row = (
        await db.execute(text("SELECT id, status FROM properties WHERE slug = :s"), {"s": slug})
    ).first()
    if not row or row[1] not in PUBLIC_STATUSES:
        raise NotFoundException("This place is not listed.")
    pid, status = str(row[0]), row[1]

    # The same reporter repeating themselves does not count twice.
    already = (
        await db.execute(
            text(
                """
                SELECT 1 FROM reports WHERE property_id = CAST(:p AS uuid) AND reason = :r AND status = 'open'
                  AND ((CAST(:d AS uuid) IS NOT NULL AND device_id = CAST(:d AS uuid))
                    OR (CAST(:u AS uuid) IS NOT NULL AND user_id = CAST(:u AS uuid)))
                """
            ),
            {"p": pid, "r": reason, "d": device_id, "u": user_id},
        )
    ).first()
    if not already:
        await db.execute(
            text(
                """
                INSERT INTO reports (property_id, reason, details, device_id, user_id, priority)
                VALUES (CAST(:p AS uuid), :r, :dt, CAST(:d AS uuid), CAST(:u AS uuid), :pr)
                """
            ),
            {"p": pid, "r": reason, "dt": (details or "")[:1000] or None, "d": device_id, "u": user_id, "pr": PRIORITY.get(reason, 0)},
        )

    distinct = (
        await db.execute(
            text(
                """
                SELECT count(DISTINCT coalesce(device_id::text, user_id::text)) FROM reports
                WHERE property_id = CAST(:p AS uuid) AND reason = :r AND status = 'open' AND created_at > now() - interval '14 days'
                """
            ),
            {"p": pid, "r": reason},
        )
    ).scalar_one()
    if distinct >= 2 and status in ("live", "stale"):
        if reason == "scam":
            await transition(db, pid, "in_review", actor_kind="system", reason="held after repeated scam reports")
        elif reason == "not_available" and status == "live":
            await transition(db, pid, "stale", actor_kind="system", reason="reported not available")
            from app.core.tasks.jobs import enqueue

            await enqueue(db, "reconfirm_property", {"property_id": pid}, idempotency_key=f"reconfirm-report:{pid}:{distinct}")
    return pid
