import uuid
from datetime import datetime, timezone
from typing import List
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundException
from app.core.security import AuthenticatedUser
from app.features.notifications.models import AppNotification, PushSubscription
from app.features.notifications.schemas import PushSubscriptionCreate


class NotificationService:
    @staticmethod
    async def subscribe_push(db: AsyncSession, user: AuthenticatedUser, data: PushSubscriptionCreate) -> PushSubscription:
        res = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == data.endpoint))
        existing = res.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if existing:
            existing.user_id = user.id
            existing.p256dh = data.p256dh
            existing.auth = data.auth
            existing.last_used_at = now
            await db.flush()
            return existing

        sub = PushSubscription(
            id=str(uuid.uuid4()),
            user_id=user.id,
            endpoint=data.endpoint,
            p256dh=data.p256dh,
            auth=data.auth,
            created_at=now,
            last_used_at=now,
        )
        db.add(sub)
        await db.flush()
        return sub

    @staticmethod
    async def unsubscribe_push(db: AsyncSession, user: AuthenticatedUser, endpoint: str) -> None:
        res = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == endpoint, PushSubscription.user_id == user.id))
        sub = res.scalar_one_or_none()
        if sub:
            await db.delete(sub)
            await db.flush()

    @staticmethod
    async def list_notifications(db: AsyncSession, user: AuthenticatedUser, limit: int = 50) -> List[AppNotification]:
        res = await db.execute(
            select(AppNotification).where(AppNotification.user_id == user.id).order_by(AppNotification.created_at.desc()).limit(limit)
        )
        return list(res.scalars().all())

    @staticmethod
    async def mark_read(db: AsyncSession, user: AuthenticatedUser, notification_id: str) -> AppNotification:
        res = await db.execute(select(AppNotification).where(AppNotification.id == notification_id, AppNotification.user_id == user.id))
        notif = res.scalar_one_or_none()
        if not notif:
            raise NotFoundException(f"Notification '{notification_id}' not found")

        notif.read = True
        await db.flush()
        return notif

    @staticmethod
    async def mark_all_read(db: AsyncSession, user: AuthenticatedUser) -> None:
        await db.execute(
            update(AppNotification).where(AppNotification.user_id == user.id).values(read=True)
        )
        await db.flush()
