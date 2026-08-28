from datetime import datetime
from typing import Optional
from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Campus(Base):
    __tablename__ = "campuses"

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=func.gen_random_uuid())
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    hero_headline: Mapped[str] = mapped_column(String, nullable=False)
    hero_subtext: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    whatsapp_number: Mapped[str] = mapped_column(String, nullable=False)
    primary_color: Mapped[str] = mapped_column(String, nullable=False)
    feature_flags: Mapped[dict] = mapped_column(JSON, nullable=False, server_default="{}")
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="active")
    region_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("regions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
