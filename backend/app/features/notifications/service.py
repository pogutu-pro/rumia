import uuid
from datetime import datetime, timezone
from typing import List
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundException
from app.core.security import AuthenticatedUser
from app.features.notifications.models import AppNotification, DeviceToken, PushSubscription
from app.features.notifications.schemas import (
    DeviceTokenActionResponse,
    DeviceTokenRegisterRequest,
    PushSubscriptionCreate,
)


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
            existing.is_active = True
            existing.last_used_at = now
            await db.flush()
            return existing

        sub = PushSubscription(
            id=str(uuid.uuid4()),
            user_id=user.id,
            endpoint=data.endpoint,
            p256dh=data.p256dh,
            auth=data.auth,
            is_active=True,
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
    async def register_device_token(
        db: AsyncSession, user: AuthenticatedUser, data: DeviceTokenRegisterRequest
    ) -> DeviceTokenActionResponse:
        res = await db.execute(select(DeviceToken).where(DeviceToken.token == data.token))
        existing = res.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if existing:
            existing.user_id = user.id
            existing.platform = data.platform
            existing.is_active = True
            existing.updated_at = now
            await db.flush()
            return DeviceTokenActionResponse(
                message="Device token updated successfully", token=data.token, is_active=True
            )

        token_obj = DeviceToken(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token=data.token,
            platform=data.platform,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(token_obj)
        await db.flush()
        return DeviceTokenActionResponse(
            message="Device token registered successfully", token=data.token, is_active=True
        )

    @staticmethod
    async def unregister_device_token(
        db: AsyncSession, user: AuthenticatedUser, token: str
    ) -> DeviceTokenActionResponse:
        res = await db.execute(
            select(DeviceToken).where(
                DeviceToken.token == token, DeviceToken.user_id == user.id
            )
        )
        existing = res.scalar_one_or_none()
        if existing:
            existing.is_active = False
            existing.updated_at = datetime.now(timezone.utc)
            await db.flush()

        return DeviceTokenActionResponse(
            message="Device token unregistered successfully", token=token, is_active=False
        )

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
