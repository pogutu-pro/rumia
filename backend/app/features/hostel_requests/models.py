"""SQLAlchemy models for the "Find Me a Hostel" hostel requests feature."""

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class HostelRequest(Base):
    """A student-initiated hostel search request handled by a campus manager."""

    __tablename__ = "hostel_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    student_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    campus_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    preferred_zone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    budget_range: Mapped[str] = mapped_column(String, nullable=False)
    gender: Mapped[str] = mapped_column(String, default="no_preference", nullable=False)
    room_type: Mapped[str] = mapped_column(String, default="no_preference", nullable=False)
    furnishing: Mapped[str] = mapped_column(String, default="no_preference", nullable=False)
    stay_preference: Mapped[str] = mapped_column(String, default="no_preference", nullable=False)
    move_in_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    additional_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="waiting", nullable=False, index=True)
    fee: Mapped[float] = mapped_column(Numeric, default=100, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )