import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserProfile(Base):
    __tablename__ = "profiles"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="student", nullable=False)
    campus_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), nullable=False)
    home_campus_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    managed_campus_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    managed_region_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    home_campus_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # The live profiles table has no boolean confirmation column; the app
    # confirms a campus by setting home_campus_confirmed_at (NULL = not
    # confirmed). Expose a derived boolean for the API response/schema.
    home_campus_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Derived from the Google OAuth email on each login (see migration 20260818000000).
    school_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    school_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)

    @hybrid_property
    def home_campus_confirmed(self) -> bool:
        return self.home_campus_confirmed_at is not None
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

