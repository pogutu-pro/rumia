import asyncio
from pathlib import Path

import pytest

from app.core.tasks import cron

ROOT = Path(__file__).resolve().parents[2]


def test_the_script_and_the_job_share_one_definition_of_the_check():
    link = ROOT / "scripts" / "check-projection-drift.sql"
    app_file = ROOT / "backend" / "app" / "features" / "catalog" / "drift_check.sql"
    assert link.is_symlink() and link.resolve() == app_file.resolve()
    assert app_file.read_text().lstrip().startswith("--")  # still the documented query, not an empty file


@pytest.mark.asyncio
async def test_a_job_can_run_soon_after_start_and_then_on_its_interval(monkeypatch):
    waits, runs = [], []
    real_sleep = asyncio.sleep

    async def fake_sleep(seconds):
        waits.append(seconds)
        await real_sleep(0)

    async def job():
        runs.append(1)
        if len(runs) == 2:
            raise asyncio.CancelledError

    monkeypatch.setattr(cron.asyncio, "sleep", fake_sleep)
    with pytest.raises(asyncio.CancelledError):
        await cron._run_cron_loop(86400, job, first_delay=300)
    assert waits == [300, 86400] and len(runs) == 2


@pytest.mark.asyncio
async def test_without_a_first_delay_a_job_still_waits_one_full_interval(monkeypatch):
    waits = []

    async def fake_sleep(seconds):
        waits.append(seconds)

    async def job():
        raise asyncio.CancelledError

    monkeypatch.setattr(cron.asyncio, "sleep", fake_sleep)
    with pytest.raises(asyncio.CancelledError):
        await cron._run_cron_loop(900, job)
    assert waits == [900]


@pytest.mark.asyncio
async def test_a_failing_job_is_logged_and_the_loop_keeps_going(monkeypatch, caplog):
    runs = []

    async def fake_sleep(seconds):
        return None

    async def job():
        runs.append(1)
        if len(runs) == 1:
            raise RuntimeError("boom")
        raise asyncio.CancelledError

    monkeypatch.setattr(cron.asyncio, "sleep", fake_sleep)
    with caplog.at_level("ERROR"), pytest.raises(asyncio.CancelledError):
        await cron._run_cron_loop(60, job)
    assert len(runs) == 2 and any("boom" in r.getMessage() for r in caplog.records)
