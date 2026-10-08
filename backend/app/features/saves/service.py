from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.device import touch_device
from app.core.errors import BadRequestException, NotFoundException


class SaveService:
    """Saves work without an account (per device) and with one (the existing `wishlists`)."""

    @staticmethod
    async def _listing_exists(db: AsyncSession, listing_id: str) -> None:
        row = (await db.execute(text("SELECT 1 FROM listings WHERE id = CAST(:l AS uuid)"), {"l": listing_id})).first()
        if not row:
            raise NotFoundException("Listing not found.")

    @staticmethod
    async def list_ids(db: AsyncSession, user_id: Optional[str], device_id: Optional[str]) -> List[str]:
        if user_id:
            rows = await db.execute(
                text("SELECT listing_id FROM wishlists WHERE user_id = CAST(:u AS uuid) ORDER BY created_at DESC"),
                {"u": user_id},
            )
        elif device_id:
            rows = await db.execute(
                text("SELECT listing_id FROM device_saves WHERE device_id = CAST(:d AS uuid) ORDER BY created_at DESC"),
                {"d": device_id},
            )
        else:
            return []
        return [str(r[0]) for r in rows.all()]

    @staticmethod
    async def add(db: AsyncSession, listing_id: str, user_id: Optional[str], device_id: Optional[str]) -> None:
        await SaveService._listing_exists(db, listing_id)
        if user_id:
            await db.execute(
                text(
                    """
                    INSERT INTO wishlists (user_id, listing_id)
                    SELECT CAST(:u AS uuid), CAST(:l AS uuid)
                    WHERE NOT EXISTS (
                        SELECT 1 FROM wishlists WHERE user_id = CAST(:u AS uuid) AND listing_id = CAST(:l AS uuid))
                    """
                ),
                {"u": user_id, "l": listing_id},
            )
        elif device_id:
            await touch_device(db, device_id)
            await db.execute(
                text(
                    "INSERT INTO device_saves (device_id, listing_id) VALUES (CAST(:d AS uuid), CAST(:l AS uuid)) ON CONFLICT DO NOTHING"
                ),
                {"d": device_id, "l": listing_id},
            )
        else:
            raise BadRequestException("A device id (X-Device-Id) or a signed-in session is required to save.")

    @staticmethod
    async def remove(db: AsyncSession, listing_id: str, user_id: Optional[str], device_id: Optional[str]) -> None:
        if user_id:
            await db.execute(
                text("DELETE FROM wishlists WHERE user_id = CAST(:u AS uuid) AND listing_id = CAST(:l AS uuid)"),
                {"u": user_id, "l": listing_id},
            )
        elif device_id:
            await db.execute(
                text("DELETE FROM device_saves WHERE device_id = CAST(:d AS uuid) AND listing_id = CAST(:l AS uuid)"),
                {"d": device_id, "l": listing_id},
            )

    @staticmethod
    async def merge_device_into_user(db: AsyncSession, user_id: str, device_id: str) -> int:
        """After sign-in: move this device's saves into the account and link the device to the user."""
        await touch_device(db, device_id, user_id)
        moved = await db.execute(
            text(
                """
                INSERT INTO wishlists (user_id, listing_id)
                SELECT CAST(:u AS uuid), ds.listing_id FROM device_saves ds
                WHERE ds.device_id = CAST(:d AS uuid)
                  AND NOT EXISTS (SELECT 1 FROM wishlists w WHERE w.user_id = CAST(:u AS uuid) AND w.listing_id = ds.listing_id)
                RETURNING listing_id
                """
            ),
            {"u": user_id, "d": device_id},
        )
        count = len(moved.all())
        await db.execute(text("DELETE FROM device_saves WHERE device_id = CAST(:d AS uuid)"), {"d": device_id})
        return count
