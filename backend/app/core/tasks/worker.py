"""Background task workers — non-blocking asyncio-native job runners.

No Celery/Redis: Rumia runs in-process asyncio workers dispatched via FastAPI
BackgroundTasks, matching the existing architecture. Business-critical state
(delivery rows, idempotency) lives in the database, which is the source of
truth; workers only execute sends and update status.
"""
import asyncio
import hashlib
import json
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
# Wishlist notification event dispatch
# ─────────────────────────────────────────────────────────────────────────────

async def dispatch_wishlist_event(
    listing_id: str,
    notification_type: str,
    event_data: dict,
) -> None:
    """
    Background processing of a wishlist event (availability/price/info change).

    Steps:
      1. Dedup at the listing level (dispatching window).
      2. Gather wishlist users for the listing.
      3. Per user: dedup, create in-app notification, respect preferences.
      4. Enqueue/send email deliveries (Brevo) with rate-limit pacing.
      5. Dispatch push to all active web/mobile tokens.

    Runs after the HTTP response is sent; the API returns immediately.
    """
    from app.features.notifications.wishlist_service import WishlistNotificationService

    try:
        from app.core.database import async_session_factory

        async with async_session_factory() as session:
            await WishlistNotificationService.process_event(
                db=session,
                listing_id=listing_id,
                notification_type=notification_type,
                event_data=event_data,
            )
    except Exception as exc:
        logger.exception(
            "Wishlist event dispatch failed listing=%s type=%s: %s",
            listing_id,
            notification_type,
            exc,
        )


async def retry_email_deliveries() -> None:
    """Retry pending/failed email deliveries (called by cron)."""
    from app.features.notifications.email_worker import EmailDeliveryWorker

    try:
        await EmailDeliveryWorker.retry_pending()
    except Exception as exc:
        logger.error("retry_email_deliveries failed: %s", exc)


async def retry_push_deliveries() -> None:
    """Retry failed push deliveries (called by cron)."""
    from app.features.notifications.push_worker import PushDeliveryWorker

    try:
        await PushDeliveryWorker.retry_pending()
    except Exception as exc:
        logger.error("retry_push_deliveries failed: %s", exc)


async def send_email_delivery(delivery_id: str) -> None:
    """Send a single email delivery row through the email provider."""
    from app.features.notifications.email_worker import EmailDeliveryWorker

    try:
        await EmailDeliveryWorker.send_one(delivery_id=delivery_id)
    except Exception as exc:
        logger.error("send_email_delivery %s failed: %s", delivery_id, exc)


# ─────────────────────────────────────────────────────────────────────────────
# Push dispatch (web + mobile) for a single user
# ─────────────────────────────────────────────────────────────────────────────

async def send_push_to_user(
    user_id: str,
    title: str,
    message: str,
    data: Optional[Dict[str, Any]] = None,
    with_inapp: bool = True,
    idempotency_key: Optional[str] = None,
) -> None:
    """
    Send push notifications to all active web and mobile tokens for a user.

    - Creates an in-app `app_notifications` row unless `with_inapp=False`.
    - Records per-device `push_deliveries` rows keyed by `idempotency_key`
      so retries never double-send.
    - Stale endpoints/tokens are soft-deactivated.
    """
    from app.core.integrations.expo_push import ExpoPushService
    from app.core.integrations.webpush import WebPushService

    try:
        from app.core.database import async_session_factory
        from sqlalchemy import text

        async with async_session_factory() as session:
            if with_inapp:
                notif_type = (data or {}).get("type") or "info"
                await session.execute(
                    text("""
                        INSERT INTO app_notifications (id, user_id, title, body, url, type, is_read, created_at)
                        VALUES (gen_random_uuid(), :user_id, :title, :message, :url, :type, false, now())
                    """),
                    {
                        "user_id": user_id,
                        "title": title,
                        "message": message,
                        "url": (data or {}).get("url"),
                        "type": notif_type,
                    },
                )

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

            # Create push_deliveries queue rows (dedup via idempotency_key)
            payload_sql = {
                "title": title,
                "body": message,
                "url": (data or {}).get("url"),
                "type": (data or {}).get("type") or "info",
                "listing_id": (data or {}).get("listing_id"),
            }
            for sub in subscriptions:
                key = f"{idempotency_key or 'push'}:web:{sub.id}"
                await session.execute(
                    text("""
                        INSERT INTO push_deliveries
                          (id, user_id, listing_id, notification_type, channel, token_id, status,
                           idempotency_key, payload, created_at, sent_at)
                        VALUES
                          (gen_random_uuid(), :user_id, :listing_id, :type, 'web_push', :token_id, 'sending',
                           :key, CAST(:payload AS jsonb), now(), now())
                        ON CONFLICT (idempotency_key) DO NOTHING
                    """),
                    {
                        "user_id": user_id,
                        "listing_id": payload_sql["listing_id"],
                        "type": payload_sql["type"],
                        "token_id": str(sub.id),
                        "key": key,
                        "payload": json.dumps(payload_sql),
                    },
                )
            for device_token in device_tokens:
                key = f"{idempotency_key or 'push'}:expo:{device_token.id}"
                await session.execute(
                    text("""
                        INSERT INTO push_deliveries
                          (id, user_id, listing_id, notification_type, channel, token_id, status,
                           idempotency_key, payload, created_at, sent_at)
                        VALUES
                          (gen_random_uuid(), :user_id, :listing_id, :type, 'expo_push', :token_id, 'sending',
                           :key, CAST(:payload AS jsonb), now(), now())
                        ON CONFLICT (idempotency_key) DO NOTHING
                    """),
                    {
                        "user_id": user_id,
                        "listing_id": payload_sql["listing_id"],
                        "type": payload_sql["type"],
                        "token_id": str(device_token.id),
                        "key": key,
                        "payload": json.dumps(payload_sql),
                    },
                )
            await session.commit()

        # Send pushes (external calls; no DB involvement) and collect outcomes.
        delivery_updates: list[tuple[str, str, str]] = []  # (idempotency_key, status, error)
        stale_web_ids: list[str] = []
        stale_device_ids: list[str] = []
        for sub in subscriptions:
            key = f"{idempotency_key or 'push'}:web:{sub.id}"
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
                delivery_updates.append((key, "cancelled", "stale endpoint"))
            elif push_status == "delivered":
                delivery_updates.append((key, "delivered", None))
            else:
                delivery_updates.append((key, "failed", "push provider failed"))

        for device_token in device_tokens:
            key = f"{idempotency_key or 'push'}:expo:{device_token.id}"
            push_status = await ExpoPushService.send_push(
                token=device_token.token,
                title=title,
                body=message,
                data=data,
            )
            if push_status == "stale":
                stale_device_ids.append(str(device_token.id))
                delivery_updates.append((key, "cancelled", "stale token"))
            elif push_status == "delivered":
                delivery_updates.append((key, "delivered", None))
            else:
                delivery_updates.append((key, "failed", "push provider failed"))

        # Batch all status updates + stale-token pruning in a single write session.
        async with async_session_factory() as session:
            for key, delivery_status, error in delivery_updates:
                await session.execute(
                    text("""
                        UPDATE push_deliveries
                        SET status = :status,
                            error_message = :error,
                            sent_at = CASE WHEN :status = 'delivered' THEN now() ELSE sent_at END,
                            updated_at = now()
                        WHERE idempotency_key = :key
                    """),
                    {"status": delivery_status, "error": error, "key": key},
                )
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

        if stale_web_ids or stale_device_ids:
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


def enqueue_wishlist_event(
    background_tasks,
    listing_id: str,
    notification_type: str,
    event_data: Optional[Dict[str, Any]] = None,
) -> None:
    """Add a wishlist event dispatch job to FastAPI background tasks."""
    background_tasks.add_task(
        dispatch_wishlist_event,
        listing_id,
        notification_type,
        event_data or {},
    )


def enqueue_email_delivery(background_tasks, delivery_id: str) -> None:
    """Add a single email delivery job to FastAPI background tasks."""
    background_tasks.add_task(send_email_delivery, delivery_id)