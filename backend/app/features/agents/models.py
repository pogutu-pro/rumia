import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AgentProfile(Base):
    __tablename__ = "agents"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    whatsapp: Mapped[str] = mapped_column(String, nullable=False)
    commission_balance: Mapped[float] = mapped_column(Numeric, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active", nullable=False)
    campus_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("campuses.id", ondelete="SET NULL"), nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)

    portfolio_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_founder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_support: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_photo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    slug: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    cover_image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    service_areas: Mapped[Optional[list]] = mapped_column(ARRAY(String), nullable=True)
    languages: Mapped[Optional[list]] = mapped_column(ARRAY(String), nullable=True)
    helping_since: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    instagram: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    linkedin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    instagram_public: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    linkedin_public: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    verified: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    pochi_la_biashara_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    expected_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    support_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_owner: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    suspension_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AgentApplication(Base):
    __tablename__ = "agent_applications"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), nullable=False)
    campus_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("campuses.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    id_number: Mapped[str] = mapped_column(String, nullable=False)
    hostel_name: Mapped[str] = mapped_column(String, nullable=False)
    relationship_to_hostel: Mapped[str] = mapped_column(String, nullable=False)
    owner_contact: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    reviewed_by: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
