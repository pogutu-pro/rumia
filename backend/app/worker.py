"""Dedicated process for scheduled jobs: `python -m app.worker`.

Run exactly one replica. Delivery rows are claimed with FOR UPDATE SKIP LOCKED, so an accidental
second copy cannot double-send, but there is no reason to run more than one.
"""

import asyncio

from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.core.sentry import init_sentry
from app.core.tasks.cron import start_cron_jobs


async def main() -> None:
    setup_logging()
    init_sentry()
    logger.info("Starting Rumia worker", version=settings.VERSION, environment=settings.ENVIRONMENT)
    start_cron_jobs()
    await asyncio.Event().wait()  # run until the container stops


if __name__ == "__main__":
    asyncio.run(main())
