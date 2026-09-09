import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundException
from app.core.security import AuthenticatedUser
from app.features.notifications.models import (
    AppNotification,
    DeviceToken,
    NotificationPreference,
    PushSubscription,
)
from app.features.notifications.schemas import (
    DeviceTokenActionResponse,
    DeviceTokenRegisterRequest,
    NotificationPreferenceActionResponse,
    NotificationPreferenceUpdate,
    PushSubscriptionCreate,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class NotificationService:
    """In-app notification + device/push subscription management."""

    # ── In-app notifications ──────────────────────────────────────────────

    @staticmethod
    async def create_notification(
        db: AsyncSession,
        user_id: str,
        title: str,
        body: str,
        type: str = "info",
        url: Optional[str] = None,
    ) -> AppNotification:
        notif = AppNotification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            body=body,
            type=type,
            url=url,
            created_at=_now(),
        )
        db.add(notif)
        await db.flush()
        return notif

    @staticmethod
    async def list_notifications(
        db: AsyncSession, user: AuthenticatedUser, limit: int = 50
    ) -> List[AppNotification]:
        res = await db.execute(
            select(AppNotification)
            .where(AppNotification.user_id == user.id)
            .order_by(AppNotification.created_at.desc())
            .limit(limit)
        )
        return list(res.scalars().all())

    @staticmethod
    async def unread_count(db: AsyncSession, user: AuthenticatedUser) -> int:
        res = await db.execute(
            select(func.count(AppNotification.id)).where(
                AppNotification.user_id == user.id,
                AppNotification.is_read.is_(False),
            )
        )
        return res.scalar_one() or 0

    @staticmethod
    async def mark_read(db: AsyncSession, user: AuthenticatedUser, notification_id: str) -> AppNotification:
        res = await db.execute(
            select(AppNotification).where(
                AppNotification.id == notification_id,
                AppNotification.user_id == user.id,
            )
        )
        notif = res.scalar_one_or_none()
        if not notif:
            raise NotFoundException(f"Notification '{notification_id}' not found")

        notif.is_read = True
        await db.flush()
        return notif

    @staticmethod
    async def mark_all_read(db: AsyncSession, user: AuthenticatedUser) -> None:
        await db.execute(
            update(AppNotification)
            .where(AppNotification.user_id == user.id)
            .values(is_read=True)
        )
        await db.flush()

    # ── Push subscriptions (web) ──────────────────────────────────────────

    @staticmethod
    async def subscribe_push(db: AsyncSession, user: AuthenticatedUser, data: PushSubscriptionCreate) -> PushSubscription:
        res = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == data.endpoint))
        existing = res.scalar_one_or_none()
        now = _now()
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
        res = await db.execute(
            select(PushSubscription).where(
                PushSubscription.endpoint == endpoint,
                PushSubscription.user_id == user.id,
            )
        )
        sub = res.scalar_one_or_none()
        if sub:
            await db.delete(sub)
            await db.flush()

    # ── Device tokens (mobile) ────────────────────────────────────────────

    @staticmethod
    async def register_device_token(
        db: AsyncSession, user: AuthenticatedUser, data: DeviceTokenRegisterRequest
    ) -> DeviceTokenActionResponse:
        res = await db.execute(select(DeviceToken).where(DeviceToken.token == data.token))
        existing = res.scalar_one_or_none()
        now = _now()
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
                DeviceToken.token == token,
                DeviceToken.user_id == user.id,
            )
        )
        existing = res.scalar_one_or_none()
        if existing:
            existing.is_active = False
            existing.updated_at = _now()
            await db.flush()

        return DeviceTokenActionResponse(
            message="Device token unregistered successfully", token=token, is_active=False
        )

    # ── Notification preferences ──────────────────────────────────────────

    @staticmethod
    async def get_or_create_preferences(
        db: AsyncSession, user: AuthenticatedUser
    ) -> NotificationPreference:
        res = await db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user.id)
        )
        pref = res.scalar_one_or_none()
        if not pref:
            pref = NotificationPreference(
                user_id=user.id,
                wishlist_push_enabled=True,
                wishlist_email_enabled=True,
            )
            db.add(pref)
            await db.flush()
        return pref

    @staticmethod
    async def list_preferences(
        db: AsyncSession, user: AuthenticatedUser
    ) -> NotificationPreference:
        return await NotificationService.get_or_create_preferences(db, user)

    @staticmethod
    async def update_preferences(
        db: AsyncSession, user: AuthenticatedUser, data: NotificationPreferenceUpdate
    ) -> NotificationPreferenceActionResponse:
        pref = await NotificationService.get_or_create_preferences(db, user)
        if data.wishlist_push_enabled is not None:
            pref.wishlist_push_enabled = data.wishlist_push_enabled
        if data.wishlist_email_enabled is not None:
            pref.wishlist_email_enabled = data.wishlist_email_enabled
        pref.updated_at = _now()
        await db.flush()
        return NotificationPreferenceActionResponse(
            message="Notification preferences updated successfully",
            wishlist_push_enabled=pref.wishlist_push_enabled,
            wishlist_email_enabled=pref.wishlist_email_enabled,
        )

    @staticmethod
    async def are_wishlist_emails_enabled(db: AsyncSession, user_id: str) -> bool:
        res = await db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        pref = res.scalar_one_or_none()
        return pref.wishlist_email_enabled if pref else True

    @staticmethod
    async def are_wishlist_pushes_enabled(db: AsyncSession, user_id: str) -> bool:
        res = await db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        pref = res.scalar_one_or_none()
        return pref.wishlist_push_enabled if pref else True