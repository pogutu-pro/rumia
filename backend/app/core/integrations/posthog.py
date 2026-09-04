"""Server-side PostHog analytics event dispatcher."""
import logging
from typing import Any, Dict, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_client():
    """Lazily initialise PostHog client — avoids import cost when not configured."""
    if not settings.POSTHOG_PROJECT_TOKEN:
        return None
    try:
        from posthog import Posthog
        return Posthog(
            project_api_key=settings.POSTHOG_PROJECT_TOKEN,
            host=settings.POSTHOG_HOST,
        )
    except ImportError:
        logger.warning("posthog package not installed — skipping telemetry")
        return None


# Singleton client (initialised on first use)
_client = None


def _client_instance():
    global _client
    if _client is None:
        _client = _get_client()
    return _client


def capture(
    distinct_id: str,
    event_name: str,
    properties: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Fire a server-side analytics event.

    This is intentionally best-effort — errors are logged but never raised
    to the caller so that analytics never breaks the request pipeline.
    """
    client = _client_instance()
    if client is None:
        return
    try:
        client.capture(
            distinct_id=distinct_id,
            event=event_name,
            properties=properties or {},
        )
    except Exception as exc:
        logger.warning("PostHog capture failed: %s", exc)


# ── Convenience helpers ──────────────────────────────────────────────────────

def track_lead_created(user_id: str, listing_id: str, agent_id: str) -> None:
    capture(user_id, "lead_created", {
        "listing_id": listing_id,
        "agent_id": agent_id,
    })


def track_tour_booked(user_id: str, listing_id: str, tour_date: str) -> None:
    capture(user_id, "tour_booked", {
        "listing_id": listing_id,
        "tour_date": tour_date,
    })


def track_review_submitted(user_id: str, listing_id: str, rating: int) -> None:
    capture(user_id, "review_submitted", {
        "listing_id": listing_id,
        "rating": rating,
    })


def track_listing_viewed(listing_id: str, user_id: Optional[str] = None) -> None:
    distinct_id = user_id or f"anon_{listing_id}"
    capture(distinct_id, "listing_viewed", {"listing_id": listing_id})
