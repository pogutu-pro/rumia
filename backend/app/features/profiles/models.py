import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserProfile(Base):
    __tablename__ = "profiles"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="student", nullable=False)
    campus_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    home_campus_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    managed_campus_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    managed_region_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    home_campus_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    home_campus_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Wishlist(Base):
    __tablename__ = "wishlists"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), nullable=False)
    listing_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

