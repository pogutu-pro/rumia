"""Postgres-backed job queue: durable, claimed with FOR UPDATE SKIP LOCKED, retried with backoff.

Used for work that must not be lost or run twice: image processing, reconfirmation messages.
"""
import json
import logging
from datetime import timedelta
from typing import Any, Awaitable, Callable, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

Handler = Callable[[Dict[str, Any]], Awaitable[None]]
HANDLERS: Dict[str, Handler] = {}
LEASE_SECONDS = 300


def register(kind: str) -> Callable[[Handler], Handler]:
    def deco(fn: Handler) -> Handler:
        HANDLERS[kind] = fn
        return fn

    return deco


async def enqueue(
    db: AsyncSession,
    kind: str,
    payload: Dict[str, Any],
    *,
    run_in_seconds: int = 0,
    idempotency_key: Optional[str] = None,
) -> Optional[int]:
    """Add a job. With an idempotency key, enqueueing the same work twice is a no-op (returns None)."""
    row = (
        await db.execute(
            text(
                """
                INSERT INTO jobs (kind, payload, run_at, idempotency_key)
                VALUES (:k, CAST(:p AS jsonb), now() + make_interval(secs => :delay), :ik)
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id
                """
            ),
            {"k": kind, "p": json.dumps(payload), "delay": run_in_seconds, "ik": idempotency_key},
        )
    ).first()
    return int(row[0]) if row else None


async def claim_due(db: AsyncSession, limit: int = 10):
    """Atomically take due jobs: queued ones, and running ones whose lease expired (worker died)."""
    rows = await db.execute(
        text(
            """
            UPDATE jobs SET status = 'running', attempts = attempts + 1,
                            locked_until = now() + make_interval(secs => :lease)
            WHERE id IN (
                SELECT id FROM jobs
                WHERE ((status = 'queued' AND run_at <= now()) OR (status = 'running' AND locked_until < now()))
                  AND attempts < max_attempts
                ORDER BY run_at
                LIMIT :n
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, kind, payload, attempts, max_attempts
            """
        ),
        {"lease": LEASE_SECONDS, "n": limit},
    )
    return rows.mappings().all()


async def finish(db: AsyncSession, job_id: int, error: Optional[str], attempts: int, max_attempts: int) -> None:
    if error is None:
        await db.execute(text("UPDATE jobs SET status = 'done', finished_at = now(), last_error = NULL WHERE id = :i"), {"i": job_id})
        return
    if attempts >= max_attempts:
        await db.execute(
            text("UPDATE jobs SET status = 'failed', finished_at = now(), last_error = :e WHERE id = :i"),
            {"i": job_id, "e": error[:2000]},
        )
        return
    backoff = int(timedelta(seconds=30 * (2 ** (attempts - 1))).total_seconds())  # 30s, 60s, 2m, 4m ...
    await db.execute(
        text(
            "UPDATE jobs SET status = 'queued', last_error = :e, locked_until = NULL, "
            "run_at = now() + make_interval(secs => :b) WHERE id = :i"
        ),
        {"i": job_id, "e": error[:2000], "b": backoff},
    )


async def run_due_jobs(session_factory, limit: int = 10) -> int:
    """Claim and run due jobs; each job's outcome is committed independently."""
    async with session_factory() as db:
        claimed = [dict(r) for r in await claim_due(db, limit)]
        await db.commit()
    for job in claimed:
        handler = HANDLERS.get(job["kind"])
        error: Optional[str] = None
        if handler is None:
            error = f"no handler registered for job kind {job['kind']!r}"
        else:
            try:
                payload = job["payload"] if isinstance(job["payload"], dict) else json.loads(job["payload"])
                await handler(payload)
            except Exception as exc:  # recorded and retried; never crashes the worker loop
                logger.exception("job %s (%s) failed", job["id"], job["kind"])
                error = f"{type(exc).__name__}: {exc}"
        async with session_factory() as db:
            await finish(db, job["id"], error, job["attempts"], job["max_attempts"])
            await db.commit()
    return len(claimed)
