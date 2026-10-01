import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class OfficialHostel(Base):
    """An entry in the official DeKUT housing records, used to verify listings."""

    __tablename__ = "dekut_official_hostels"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    hostel_name: Mapped[str] = mapped_column(Text, nullable=False)
    zone: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contacts: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    verified_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
