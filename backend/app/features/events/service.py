import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.device import touch_device
from app.features.events.schemas import EventBatch

MAX_PAST = timedelta(days=2)
MAX_FUTURE = timedelta(minutes=5)


def _valid_uuid(value: Optional[str]) -> Optional[str]:
    try:
        return str(uuid.UUID(value)) if value else None
    except ValueError:
        return None


class EventService:
    @staticmethod
    async def ingest(db: AsyncSession, batch: EventBatch, device_id: Optional[str], user_id: Optional[str]) -> int:
        """Store a batch. Timestamps are clamped to a sane window; duplicate event ids are ignored."""
        now = datetime.now(timezone.utc)
        rows = []
        for e in batch.events:
            occurred = e.occurred_at or now
            if occurred.tzinfo is None:
                occurred = occurred.replace(tzinfo=timezone.utc)
            if occurred < now - MAX_PAST or occurred > now + MAX_FUTURE:
                occurred = now
            rows.append(
                {
                    "id": _valid_uuid(e.event_id) or str(uuid.uuid4()),
                    "occurred_at": occurred,
                    "name": e.name,
                    "device_id": device_id,
                    "user_id": user_id,
                    "session_id": batch.session_id,
                    "market": e.market,
                    "surface": e.surface,
                    "referrer_kind": e.referrer_kind,
                    "listing_id": _valid_uuid(e.listing_id),
                    "props": json.dumps(e.props, default=str),
                }
            )
        if device_id:
            await touch_device(db, device_id, user_id)
        await db.execute(
            text(
                """
                INSERT INTO events (id, occurred_at, name, device_id, user_id, session_id, market, surface,
                                    referrer_kind, listing_id, props)
                VALUES (CAST(:id AS uuid), :occurred_at, :name, CAST(:device_id AS uuid), CAST(:user_id AS uuid),
                        :session_id, :market, :surface, :referrer_kind, CAST(:listing_id AS uuid),
                        CAST(:props AS jsonb))
                ON CONFLICT DO NOTHING
                """
            ),
            rows,
        )
        return len(rows)
