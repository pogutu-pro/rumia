import asyncio
from unittest.mock import patch

import pytest

from app import worker


@pytest.mark.asyncio
async def test_worker_starts_the_scheduler_and_keeps_running():
    with patch.object(worker, "start_cron_jobs") as start, patch.object(worker, "init_sentry"), patch.object(
        worker, "setup_logging"
    ):
        task = asyncio.create_task(worker.main())
        await asyncio.sleep(0.05)
        assert not task.done()  # stays alive until the container stops
        start.assert_called_once()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
