from datetime import date, datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import ARRAY, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BnbDetails(Base):
    __tablename__ = "bnb_details"

    listing_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=False),
        ForeignKey("listings.id", ondelete="CASCADE"),
        primary_key=True,
    )

    listing_type: Mapped[str] = mapped_column(String, nullable=False, server_default="entire_place")

    max_guests: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bedrooms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bathrooms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bed_config: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default="[]")

    price_unit: Mapped[str] = mapped_column(String, nullable=False, server_default="night")
    min_stay_nights: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    max_stay_nights: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cleaning_fee: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    security_deposit: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    extra_guest_fee: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)

    available_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    available_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    check_in_time: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    check_out_time: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    advance_notice_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    house_rules: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    custom_rules: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    guest_suitability: Mapped[List[str]] = mapped_column(ARRAY(String), nullable=False, server_default="{}")

    nearby_landmark: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
