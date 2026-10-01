import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), nullable=False)
    endpoint: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    p256dh: Mapped[str] = mapped_column(String, nullable=False)
    auth: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AppNotification(Base):
    """In-app notification row.

    The DATABASE table `app_notifications` is the source of truth and uses
    `title, body, url, is_read, created_at` columns (plus `type` added in the
    20260905 migration). The ORM maps those columns to message-friendly names.
    """

    __tablename__ = "app_notifications"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, name="body")
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True, name="url")
    type: Mapped[str] = mapped_column(String, default="info", nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, name="is_read")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    @property
    def message(self) -> str:
        return self.body

    @property
    def read(self) -> bool:
        return self.is_read


class DeviceToken(Base):
    __tablename__ = "device_tokens"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), nullable=False)
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    platform: Mapped[str] = mapped_column(String, default="android", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class NotificationPreference(Base):
    """Per-user channel opt-in for wishlist notifications.

    Wishlist membership is SEPARATE from notification consent: a user may
    wishlist a hostel while keeping both channels disabled.
    """

    __tablename__ = "notification_preferences"
    __table_args__ = {"extend_existing": True}

    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True)
    wishlist_push_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    wishlist_email_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class EmailDelivery(Base):
    """Per-recipient email delivery record (Brevo provider tracking)."""

    __tablename__ = "email_deliveries"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    listing_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)
    notification_type: Mapped[str] = mapped_column(String, nullable=False)
    to_email: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    template_name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    provider: Mapped[str] = mapped_column(String, default="brevo", nullable=False)
    provider_message_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class WishlistNotificationEvent(Base):
    """Idempotency/dedup guard for event-driven wishlist notifications.

    One row per (user, listing, notification_type) dispatch. Uniqueness of
    `event_key` prevents duplicate sends when the same event fires repeatedly.
    """

    __tablename__ = "wishlist_notification_events"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    listing_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    notification_type: Mapped[str] = mapped_column(String, nullable=False)
    event_key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)