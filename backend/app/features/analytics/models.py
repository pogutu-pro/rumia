from datetime import date, datetime
from typing import Optional
from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ListingView(Base):
    __tablename__ = "listing_views"

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=func.gen_random_uuid())
    listing_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("listings.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    ip_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class ListingViewDailyRollup(Base):
    __tablename__ = "listing_view_daily_rollup"

    listing_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True)
    view_date: Mapped[date] = mapped_column(Date, primary_key=True)
    view_count: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
