import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserProfile(Base):
    __tablename__ = "profiles"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="student", nullable=False)
    campus_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    home_campus_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    managed_campus_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    managed_region_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    home_campus_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    home_campus_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
