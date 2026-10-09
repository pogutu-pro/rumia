"""Ask the owner to reconfirm availability, with one-tap links.

Delivery today: email (Brevo), when the lister has an email and Brevo is configured; otherwise the message
is logged so ops can follow up. WhatsApp/SMS plug in here as another `Channel` once a provider is chosen.
"""
import html
import logging
from typing import List, Protocol

from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.tasks.jobs import register
from app.features.catalog.lifecycle import make_action_token

logger = logging.getLogger(__name__)


class Channel(Protocol):
    name: str

    async def send(self, to: str, subject: str, text_body: str, html_body: str) -> bool: ...


class EmailChannel:
    name = "email"

    async def send(self, to: str, subject: str, text_body: str, html_body: str) -> bool:
        from app.core.email import email_service

        result = await email_service.send(to_email=to, to_name=None, subject=subject, html_content=html_body,
                                          text_content=text_body, tags=["reconfirm"])
        return bool(result.success)


CHANNELS: List[Channel] = [EmailChannel()]


def build_message(property_name: str, links: dict) -> tuple[str, str, str]:
    subject = f"Is {property_name} still available?"
    plain = (
        f"Hello,\n\nPlease tell Rumia whether {property_name} is still available. One tap is enough:\n\n"
        f"Still available: {links['confirm']}\nLet / full: {links['let']}\nPause the listing: {links['pause']}\n\n"
        "Listings that are not confirmed are shown lower and then hidden, so seekers are not sent to places that are gone.\n"
    )
    h = html.escape
    page = (
        f"<p>Hello,</p><p>Please tell Rumia whether <strong>{h(property_name)}</strong> is still available. One tap is enough:</p>"
        f'<p><a href="{h(links["confirm"])}">Still available</a> &middot; <a href="{h(links["let"])}">Let / full</a> '
        f'&middot; <a href="{h(links["pause"])}">Pause the listing</a></p>'
        "<p>Listings that are not confirmed are shown lower and then hidden, so seekers are not sent to places that are gone.</p>"
    )
    return subject, plain, page


@register("reconfirm_property")
async def reconfirm_property(payload: dict) -> None:
    pid = payload["property_id"]
    async with async_session_factory() as db:
        prop = (await db.execute(text("SELECT name, status FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).first()
        if not prop or prop[1] not in ("live", "stale"):
            return  # already handled or no longer relevant
        recipients = [
            r[0]
            for r in (
                await db.execute(
                    text(
                        """
                        SELECT u.email FROM properties p
                        JOIN org_members m ON m.org_id = p.org_id AND m.role IN ('owner', 'manager')
                        JOIN auth.users u ON u.id = m.user_id
                        WHERE p.id = CAST(:p AS uuid) AND u.email IS NOT NULL
                        ORDER BY (m.role = 'owner') DESC
                        """
                    ),
                    {"p": pid},
                )
            ).all()
        ]
    links = {a: f"{settings.PUBLIC_BASE_URL}/c/{make_action_token(pid, a)}" for a in ("confirm", "let", "pause")}
    subject, plain, page = build_message(prop[0], links)
    delivered = False
    for to in recipients[:2]:
        for channel in CHANNELS:
            try:
                delivered = await channel.send(to, subject, plain, page) or delivered
            except Exception:
                logger.exception("reconfirm via %s failed for property %s", channel.name, pid)
    if not delivered:
        # Nothing could be sent (no email on file, or provider not configured): surface it to ops via the log.
        logger.warning("reconfirm for property %s not delivered; contact the lister manually. confirm link: %s", pid, links["confirm"])
