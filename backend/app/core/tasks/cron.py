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


async def run_jobs() -> None:
    """Run due queued jobs (image processing, reconfirmation messages)."""
    from app.core.database import async_session_factory
    from app.core.tasks.jobs import run_due_jobs

    _register_handlers()
    await run_due_jobs(async_session_factory, limit=10)


def _register_handlers() -> None:
    # Importing registers each module's @register("kind") handlers.
    import app.features.catalog.notify  # noqa: F401
    import app.features.media.processing  # noqa: F401


async def freshness_and_scores() -> None:
    """Ask for reconfirmation, demote and pause unconfirmed places, then refresh scores and distances."""
    from app.core.database import async_session_factory
    from app.features.catalog import service as catalog
    from app.features.catalog.lifecycle import freshness_sweep

    async with async_session_factory() as db:
        result = await freshness_sweep(db)
        await db.commit()
    async with async_session_factory() as db:
        scored = await catalog.refresh_scores(db)
        located = await catalog.refresh_distances(db)
        from app.features.media.processing import enqueue_missing_hashes

        hashed = await enqueue_missing_hashes(db, limit=200)  # backfill and safety net for photo fingerprints
        await db.commit()
    logger.info("freshness sweep %s; scored %d; distances for %d; photo fingerprints queued %d", result, scored, located, hashed)


async def send_alerts() -> None:
    from app.core.database import async_session_factory
    from app.features.discovery.alerts import send_due_alerts

    async with async_session_factory() as db:
        result = await send_due_alerts(db)
        await db.commit()
    if result["sent"]:
        logger.info("alerts: %s", result)


async def ensure_event_partitions() -> None:
    """Create the next three monthly partitions of `events` so inserts never fall into the default one."""
    from datetime import date

    from sqlalchemy import text

    from app.core.database import async_session_factory

    def month(d: date, add: int) -> date:
        idx = d.year * 12 + (d.month - 1) + add
        return date(idx // 12, idx % 12 + 1, 1)

    today = date.today()
    async with async_session_factory() as db:
        for offset in range(0, 4):
            start, end = month(today, offset), month(today, offset + 1)
            await db.execute(
                text(f"CREATE TABLE IF NOT EXISTS events_{start:%Y_%m} PARTITION OF events FOR VALUES FROM ('{start}') TO ('{end}')")
            )
        await db.commit()


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
    loop = asyncio.get_running_loop()
    # Archive expired announcements every 15 minutes
    loop.create_task(_run_cron_loop(900, archive_expired_announcements))
    # Retry pending/failed email + push deliveries every minute
    loop.create_task(_run_cron_loop(60, retry_failed_deliveries))
    # Durable jobs every 5 seconds; daily-ish maintenance (all idempotent, so re-running is harmless).
    loop.create_task(_run_cron_loop(5, run_jobs))
    loop.create_task(_run_cron_loop(6 * 3600, freshness_and_scores))
    loop.create_task(_run_cron_loop(3600, send_alerts))
    loop.create_task(_run_cron_loop(24 * 3600, ensure_event_partitions))
    logger.info("Cron jobs scheduled: announcements 15m, delivery retries 1m, job runner 5s, freshness+scores 6h, partitions daily")
