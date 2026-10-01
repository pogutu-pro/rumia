import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    listing_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    agent_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    clicked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ip_hash: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, default="whatsapp", nullable=False)
    user_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    campus_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class Commission(Base):
    __tablename__ = "commissions"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    listing_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
