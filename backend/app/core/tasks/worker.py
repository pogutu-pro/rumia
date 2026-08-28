"""Background task workers — non-blocking asyncio-native job runners."""
import asyncio
import hashlib
import logging
from typing import Any, Dict, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# View Rollup
# ─────────────────────────────────────────────────────────────────────────────

async def rollup_listing_view(listing_id: str, user_id: Optional[str], ip: str) -> None:
    """
    Increment listing view count in the database asynchronously.

    Uses a salted IP hash for deduplication so we never store raw IPs.
    """
    ip_hash = hashlib.sha256(f"rumia:{ip}".encode()).hexdigest()

    from app.core.integrations import posthog as ph
    ph.track_listing_viewed(listing_id=listing_id, user_id=user_id)

    try:
        from app.core.database import async_session_factory
        from sqlalchemy import text

        async with async_session_factory() as session:
            await session.execute(
                text("""
                    INSERT INTO listing_views (listing_id, user_id, ip_hash, viewed_at)
                    VALUES (:listing_id, :user_id, :ip_hash, now())
                    ON CONFLICT DO NOTHING
                """),
                {"listing_id": listing_id, "user_id": user_id, "ip_hash": ip_hash},
            )
            await session.commit()
    except Exception as exc:
        logger.warning("View rollup failed for listing %s: %s", listing_id, exc)


# ─────────────────────────────────────────────────────────────────────────────
# Web Push Dispatch
# ─────────────────────────────────────────────────────────────────────────────

async def send_push_to_user(
    user_id: str,
    title: str,
    message: str,
    data: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Send a Web Push notification to ALL active subscriptions for a user.
    Stale endpoints (410/404) are automatically pruned from the database.
    """
    from app.core.integrations.webpush import WebPushService

    try:
        from app.core.database import async_session_factory
        from sqlalchemy import text

        async with async_session_factory() as session:
            result = await session.execute(
                text("""
                    SELECT id, endpoint, p256dh, auth
                    FROM push_subscriptions
                    WHERE user_id = :user_id AND is_active = true
                """),
                {"user_id": user_id},
            )
            subscriptions = result.fetchall()

        stale_ids = []
        for sub in subscriptions:
            sub_info = WebPushService.build_subscription_info(
                endpoint=sub.endpoint,
                p256dh=sub.p256dh,
                auth=sub.auth,
            )
            delivered = WebPushService.send_push(
                subscription_info=sub_info,
                title=title,
                body=message,
                data=data,
            )
            if not delivered:
                stale_ids.append(str(sub.id))

        # Prune stale endpoints
        if stale_ids:
            async with async_session_factory() as session:
                await session.execute(
                    text("""
                        UPDATE push_subscriptions
                        SET is_active = false
                        WHERE id = ANY(:ids)
                    """),
                    {"ids": stale_ids},
                )
                await session.commit()
            logger.info("Pruned %d stale push subscriptions for user %s", len(stale_ids), user_id)

    except Exception as exc:
        logger.error("Push dispatch failed for user %s: %s", user_id, exc)


# ─────────────────────────────────────────────────────────────────────────────
# Enqueue helpers (for FastAPI BackgroundTasks)
# ─────────────────────────────────────────────────────────────────────────────

def enqueue_view_rollup(
    background_tasks,
    listing_id: str,
    user_id: Optional[str],
    ip: str,
) -> None:
    """Add a listing view rollup job to FastAPI background tasks."""
    background_tasks.add_task(rollup_listing_view, listing_id, user_id, ip)


def enqueue_push_notification(
    background_tasks,
    user_id: str,
    title: str,
    message: str,
    data: Optional[Dict[str, Any]] = None,
) -> None:
    """Add a Web Push dispatch job to FastAPI background tasks."""
    background_tasks.add_task(send_push_to_user, user_id, title, message, data)
