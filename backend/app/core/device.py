"""Anonymous device identity: a client-generated UUID sent as `X-Device-Id`."""
import uuid
from typing import Optional

from fastapi import Header
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def parse_device_id(value: Optional[str]) -> Optional[str]:
    """Return the canonical UUID string, or None if missing or malformed."""
    if not value:
        return None
    try:
        return str(uuid.UUID(value.strip()))
    except ValueError:
        return None


async def get_device_id(x_device_id: Optional[str] = Header(None, alias="X-Device-Id")) -> Optional[str]:
    return parse_device_id(x_device_id)


async def touch_device(db: AsyncSession, device_id: str, user_id: Optional[str] = None) -> None:
    """Record that this device was seen (and link it to the user when signed in)."""
    await db.execute(
        text(
            """
            INSERT INTO devices (id, user_id) VALUES (CAST(:d AS uuid), CAST(:u AS uuid))
            ON CONFLICT (id) DO UPDATE
              SET last_seen = now(), user_id = COALESCE(EXCLUDED.user_id, devices.user_id)
            """
        ),
        {"d": device_id, "u": user_id},
    )
