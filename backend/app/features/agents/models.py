import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AgentProfile(Base):
    __tablename__ = "agents"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    whatsapp: Mapped[str] = mapped_column(String, nullable=False)
    commission_balance: Mapped[float] = mapped_column(Numeric, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active", nullable=False)
    campus_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("campuses.id", ondelete="SET NULL"), nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    portfolio_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_founder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_support_team: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pays_commission: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    credential: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AgentApplication(Base):
    __tablename__ = "agent_applications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    campus_id: Mapped[str] = mapped_column(String, ForeignKey("campuses.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    id_number: Mapped[str] = mapped_column(String, nullable=False)
    hostel_name: Mapped[str] = mapped_column(String, nullable=False)
    relationship_to_hostel: Mapped[str] = mapped_column(String, nullable=False)
    owner_contact: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
