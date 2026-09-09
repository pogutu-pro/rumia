"""Background task cron jobs — lightweight asyncio scheduled maintenance tasks."""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def archive_expired_announcements() -> None:
    """
    Remove expired announcements from the feed.
    The announcements table has no `is_active` column; the read path filters by
    `expires_at > now()`, so old rows are simply deleted to keep the table clean.
    Runs on startup and periodically.
    """
    try:
        from app.core.database import async_session_factory
        from sqlalchemy import text

        async with async_session_factory() as session:
            result = await session.execute(
                text("""
                    DELETE FROM announcements
                    WHERE expires_at IS NOT NULL
                      AND expires_at < now()
                    RETURNING id
                """)
            )
            deleted = result.rowcount
            await session.commit()
            if deleted:
                logger.info("Deleted %d expired announcements", deleted)
    except Exception as exc:
        logger.error("archive_expired_announcements failed: %s", exc)


async def retry_failed_deliveries() -> None:
    """Retry pending/failed email and push delivery rows (maintenance sweep)."""
    from app.core.tasks.worker import retry_email_deliveries, retry_push_deliveries

    await retry_email_deliveries()
    await retry_push_deliveries()


async def _run_cron_loop(interval_seconds: int, coro_fn) -> None:
    """Run a coroutine on a fixed interval, logging errors without stopping the loop."""
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await coro_fn()
        except Exception as exc:
            logger.error("Cron job %s failed: %s", coro_fn.__name__, exc)


def start_cron_jobs() -> None:
    """
    Schedule recurring background maintenance tasks on the running event loop.
    Call this from FastAPI lifespan startup.
    """
    loop = asyncio.get_event_loop()
    # Archive expired announcements every 15 minutes
    loop.create_task(_run_cron_loop(900, archive_expired_announcements))
    # Retry pending/failed email + push deliveries every minute
    loop.create_task(_run_cron_loop(60, retry_failed_deliveries))
    logger.info("Cron jobs scheduled: archive_expired_announcements (every 15m), retry_failed_deliveries (every 1m)")
