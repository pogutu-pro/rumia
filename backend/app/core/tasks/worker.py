"""Background task workers — non-blocking asyncio-native job runners."""
import hashlib
import logging
from typing import Any, Dict, Optional

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
# Push Dispatch
# ─────────────────────────────────────────────────────────────────────────────

async def send_push_to_user(
    user_id: str,
    title: str,
    message: str,
    data: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Send push notifications to all active web and mobile tokens for a user.

    Stale endpoints/tokens are soft-deactivated in the database.
    """
    from app.core.integrations.expo_push import ExpoPushService
    from app.core.integrations.webpush import WebPushService

    try:
        from app.core.database import async_session_factory
        from sqlalchemy import text

        async with async_session_factory() as session:
            notif_type = (data or {}).get("type") or "info"
            await session.execute(
                text("""
                    INSERT INTO app_notifications (id, user_id, title, message, type, read, created_at)
                    VALUES (gen_random_uuid(), :user_id, :title, :message, :type, false, now())
                """),
                {
                    "user_id": user_id,
                    "title": title,
                    "message": message,
                    "type": notif_type,
                },
            )
            await session.commit()

            web_result = await session.execute(
                text("""
                    SELECT id, endpoint, p256dh, auth
                    FROM push_subscriptions
                    WHERE user_id = :user_id AND is_active = true
                """),
                {"user_id": user_id},
            )
            subscriptions = web_result.fetchall()

            device_result = await session.execute(
                text("""
                    SELECT id, token
                    FROM device_tokens
                    WHERE user_id = :user_id AND is_active = true
                """),
                {"user_id": user_id},
            )
            device_tokens = device_result.fetchall()

        stale_web_ids = []
        for sub in subscriptions:
            sub_info = WebPushService.build_subscription_info(
                endpoint=sub.endpoint,
                p256dh=sub.p256dh,
                auth=sub.auth,
            )
            push_status = WebPushService.send_push_status(
                subscription_info=sub_info,
                title=title,
                body=message,
                data=data,
            )
            if push_status == "stale":
                stale_web_ids.append(str(sub.id))

        stale_device_ids = []
        for device_token in device_tokens:
            push_status = await ExpoPushService.send_push(
                token=device_token.token,
                title=title,
                body=message,
                data=data,
            )
            if push_status == "stale":
                stale_device_ids.append(str(device_token.id))

        if stale_web_ids or stale_device_ids:
            async with async_session_factory() as session:
                for stale_id in stale_web_ids:
                    await session.execute(
                        text("""
                            UPDATE push_subscriptions
                            SET is_active = false
                            WHERE id = :id
                        """),
                        {"id": stale_id},
                    )
                for stale_id in stale_device_ids:
                    await session.execute(
                        text("""
                            UPDATE device_tokens
                            SET is_active = false, updated_at = now()
                            WHERE id = :id
                        """),
                        {"id": stale_id},
                    )
                await session.commit()
            logger.info(
                "Pruned %d stale web subscriptions and %d stale device tokens for user %s",
                len(stale_web_ids),
                len(stale_device_ids),
                user_id,
            )

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
    """Add a push dispatch job to FastAPI background tasks."""
    background_tasks.add_task(send_push_to_user, user_id, title, message, data)
