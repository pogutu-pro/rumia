import uuid
from datetime import date, datetime
from typing import Optional
from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TourBooking(Base):
    __tablename__ = "tour_bookings"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    listing_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)
    zone: Mapped[str] = mapped_column(String, nullable=False)
    tour_type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric, nullable=False)
    preferred_date: Mapped[date] = mapped_column(Date, nullable=False)
    preferred_time: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending_payment", nullable=False)
    linked_user_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    agent_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    @property
    def contacted(self) -> bool:
        # There is no `contacted` column: "contacted" is a booking status (see migration
        # 20260814020000). Exposed so API consumers keep their boolean.
        return self.status == "contacted"
