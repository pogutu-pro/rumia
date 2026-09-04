"""Background task cron jobs — lightweight asyncio scheduled maintenance tasks."""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def archive_expired_announcements() -> None:
    """
    Mark expired announcements as inactive.
    Runs on startup and periodically to keep the announcements feed clean.
    """
    try:
        from app.core.database import async_session_factory
        from sqlalchemy import text

        async with async_session_factory() as session:
            result = await session.execute(
                text("""
                    UPDATE announcements
                    SET is_active = false
                    WHERE expires_at IS NOT NULL
                      AND expires_at < now()
                      AND is_active = true
                    RETURNING id
                """)
            )
            archived = result.rowcount
            await session.commit()
            if archived:
                logger.info("Archived %d expired announcements", archived)
    except Exception as exc:
        logger.error("archive_expired_announcements failed: %s", exc)


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
    logger.info("Cron jobs scheduled: archive_expired_announcements (every 15m)")
