"""Push delivery worker — retries queued push_deliveries rows.

The database (push_deliveries) is the source of truth; rows are enqueued by
`send_push_to_user` and this worker executes per-device sends from cron,
updating status and pruning stale tokens.
"""
import asyncio
import logging

from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.integrations.expo_push import ExpoPushService
from app.core.integrations.webpush import WebPushService
from app.features.notifications.models import DeviceToken, PushSubscription

logger = logging.getLogger(__name__)

MAX_RETRY_COUNT = 3
PUSH_PACING_DELAY = 0.3

WEB_PUSH_STATUSES = {"pending", "sending", "failed"}
EXPO_PUSH_STATUSES = {"pending", "sending", "failed"}


class PushDeliveryWorker:
    @staticmethod
    async def retry_pending() -> None:
        """Retry pending/sending/failed per-device push deliveries."""
        from sqlalchemy import text

        async with async_session_factory() as session:
            res = await session.execute(
                text("""
                    SELECT pd.id, pd.channel, pd.token_id, pd.notification_type,
                           pd.user_id, pd.listing_id, pd.payload
                    FROM push_deliveries pd
                    WHERE pd.status IN ('pending', 'sending', 'failed')
                      AND pd.retry_count < :max_retry
                    ORDER BY pd.created_at ASC
                    LIMIT 500
                """),
                {"max_retry": MAX_RETRY_COUNT},
            )
            rows = [dict(r) for r in res.mappings().all()]

        for row in rows:
            row["payload"] = row.get("payload") or {}
            if row["channel"] == "web_push":
                await PushDeliveryWorker._send_web(row)
            else:
                await PushDeliveryWorker._send_expo(row)
            await asyncio.sleep(PUSH_PACING_DELAY)

        if rows:
            logger.info("retry_pending processed %d push delivery rows", len(rows))

    @staticmethod
    async def _send_web(row: dict) -> None:
        from sqlalchemy import text

        async with async_session_factory() as session:
            sub = await session.get(PushSubscription, row["token_id"])
            if not sub or not sub.is_active:
                await _mark_cancelled(row["id"])
                return

        title = row["payload"].get("title") or "Rumia"
        body = row["payload"].get("body") or "You have a new update."
        info = WebPushService.build_subscription_info(
            endpoint=sub.endpoint,
            p256dh=sub.p256dh,
            auth=sub.auth,
        )
        status = WebPushService.send_push_status(
            subscription_info=info,
            title=title,
            body=body,
            data={
                "type": row["notification_type"],
                "listing_id": row["listing_id"],
                "url": row["payload"].get("url"),
            },
        )

        if status == "delivered":
            await _mark_delivered(row["id"])
        elif status == "stale":
            async with async_session_factory() as db:
                await db.execute(
                    text("UPDATE push_subscriptions SET is_active = false WHERE id = :id"),
                    {"id": sub.id},
                )
                await db.commit()
            await _mark_cancelled(row["id"])
        else:
            await _mark_failed(row["id"])

    @staticmethod
    async def _send_expo(row: dict) -> None:
        from sqlalchemy import text

        async with async_session_factory() as session:
            token = await session.get(DeviceToken, row["token_id"])
            if not token or not token.is_active:
                await _mark_cancelled(row["id"])
                return

        title = row["payload"].get("title") or "Rumia"
        body = row["payload"].get("body") or "You have a new update."
        status = await ExpoPushService.send_push(
            token=token.token,
            title=title,
            body=body,
            data={
                "type": row["notification_type"],
                "listing_id": row["listing_id"],
                "url": row["payload"].get("url"),
            },
        )

        if status == "delivered":
            await _mark_delivered(row["id"])
        elif status == "stale":
            async with async_session_factory() as db:
                await db.execute(
                    text("UPDATE device_tokens SET is_active = false WHERE id = :id"),
                    {"id": token.id},
                )
                await db.commit()
            await _mark_cancelled(row["id"])
        else:
            await _mark_failed(row["id"])


async def _mark_delivered(delivery_id: str) -> None:
    from sqlalchemy import text

    async with async_session_factory() as session:
        await session.execute(
            text("""
                UPDATE push_deliveries
                SET status = 'delivered', sent_at = now(), error_message = NULL, updated_at = now()
                WHERE id = :id
            """),
            {"id": delivery_id},
        )
        await session.commit()


async def _mark_failed(delivery_id: str) -> None:
    from sqlalchemy import text

    async with async_session_factory() as session:
        await session.execute(
            text("""
                UPDATE push_deliveries
                SET retry_count = retry_count + 1,
                    status = CASE WHEN retry_count + 1 >= :max THEN 'failed' ELSE 'sending' END,
                    error_message = 'push provider failed',
                    updated_at = now()
                WHERE id = :id
            """),
            {"id": delivery_id, "max": MAX_RETRY_COUNT},
        )
        await session.commit()


async def _mark_cancelled(delivery_id: str) -> None:
    from sqlalchemy import text

    async with async_session_factory() as session:
        await session.execute(
            text("""
                UPDATE push_deliveries
                SET status = 'cancelled', error_message = 'stale token', updated_at = now()
                WHERE id = :id
            """),
            {"id": delivery_id},
        )
        await session.commit()