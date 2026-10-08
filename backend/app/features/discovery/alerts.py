"""Tell people when new places match a search they saved. Runs from the scheduler."""
import html
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.features.discovery import service
from app.features.discovery.service import SearchParams

logger = logging.getLogger(__name__)

DUE = {"instant": "0 seconds", "daily": "1 day", "weekly": "7 days"}
Sender = Callable[[str, str, str, str], Awaitable[bool]]


def params_from_intent(intent: Dict[str, Any], since) -> SearchParams:
    def lst(key: str) -> List[str]:
        v = intent.get(key) or []
        return [str(x) for x in v] if isinstance(v, list) else [str(v)]

    return SearchParams(
        market=intent.get("market"), q=str(intent.get("q") or ""), mode=intent.get("mode") or "monthly",
        places=lst("places"), kind=intent.get("kind"), unit_kind=lst("unit_kind"),
        min_price=intent.get("min_price"), max_price=intent.get("max_price"), amenities=lst("amenities"),
        near=intent.get("near"), max_walk=intent.get("max_walk"), gender=intent.get("gender"),
        new_since=since, sort="newest", limit=5,
    )


def compose(label: Optional[str], total: int, cards) -> tuple[str, str, str]:
    what = label or "your search"
    subject = f"{total} new place{'s' if total != 1 else ''} match {what}"
    lines = []
    for c in cards:
        price = f"KSh {int(c.from_price):,}/{'night' if c.price_period == 'night' else 'month'}"
        lines.append((c.name, price, c.place_name or "", f"{settings.PUBLIC_BASE_URL}/p/{c.slug}"))
    plain = subject + ":\n\n" + "\n".join(f"- {n} · {pr} · {pl}\n  {u}" for n, pr, pl, u in lines) + "\n"
    h = html.escape
    items = "".join(f'<li><a href="{h(u)}"><strong>{h(n)}</strong></a> · {h(pr)}{(" · " + h(pl)) if pl else ""}</li>' for n, pr, pl, u in lines)
    page = f"<p>{h(subject)}:</p><ul>{items}</ul><p>You are receiving this because you saved a search on Rumia.</p>"
    return subject, plain, page


async def _email(to: str, subject: str, plain: str, page: str) -> bool:
    from app.core.email import email_service

    result = await email_service.send(to_email=to, to_name=None, subject=subject, html_content=page, text_content=plain, tags=["alert"])
    return bool(result.success)


async def send_due_alerts(db: AsyncSession, send_email: Sender = _email) -> Dict[str, int]:
    """For each saved search that is due, find places published since it last ran and notify."""
    rows = (
        await db.execute(
            text(
                """
                SELECT id, intent, label, channel, email, phone, frequency, last_notified_at FROM saved_searches
                WHERE active AND last_notified_at <= now() - CASE frequency
                      WHEN 'instant' THEN interval '0 seconds' WHEN 'daily' THEN interval '1 day' ELSE interval '7 days' END
                """
            )
        )
    ).mappings().all()
    sent = skipped = 0
    for r in rows:
        try:
            result = await service.search(db, params_from_intent(r["intent"], r["last_notified_at"]), with_relaxations=False)
        except Exception:
            logger.exception("alert %s could not be evaluated", r["id"])
            skipped += 1
            continue
        if result.total == 0:
            skipped += 1
            continue
        subject, plain, page = compose(r["label"], result.total, result.items)
        if r["channel"] == "email" and r["email"]:
            ok = await send_email(r["email"], subject, plain, page)
            if not ok:
                skipped += 1
                continue  # try again next run; last_notified_at is unchanged
        else:
            # WhatsApp needs a connected provider (open decision); until then nothing is sent and the
            # alert keeps waiting, so nobody silently loses matches.
            logger.warning("alert %s has %d matches but WhatsApp delivery is not connected", r["id"], result.total)
            skipped += 1
            continue
        await db.execute(text("UPDATE saved_searches SET last_notified_at = now() WHERE id = :i"), {"i": r["id"]})
        sent += 1
    return {"sent": sent, "skipped": skipped}
