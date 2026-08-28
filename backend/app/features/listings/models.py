from datetime import datetime
from typing import List, Optional
from sqlalchemy import ARRAY, BOOLEAN, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    whatsapp: Mapped[str] = mapped_column(String, nullable=False)
    commission_balance: Mapped[float] = mapped_column(Numeric, server_default="0")
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="active")
    campus_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("campuses.id"), nullable=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=func.gen_random_uuid())
    title: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[float] = mapped_column(Numeric, nullable=False)
    location: Mapped[str] = mapped_column(String, nullable=False)
    county: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    area: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    specific_location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    landlord_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    youtube_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_full: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    sort_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), server_default="0.0")
    views: Mapped[int] = mapped_column(Integer, server_default="0")
    bathroom_type: Mapped[Optional[str]] = mapped_column(String, server_default="Shared")
    distance_to_campus: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    security_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    electricity_included: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    water_included: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    wifi_included: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    amenities: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), server_default="{}")
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    campus_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("campuses.id"), nullable=True, index=True)
    zone_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("campus_zones.id"), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(BOOLEAN, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    agent: Mapped[Agent] = relationship("Agent", lazy="selectin")
    images: Mapped[List["ListingImage"]] = relationship("ListingImage", back_populates="listing", lazy="selectin", order_by="ListingImage.display_order.asc()")
    room_types: Mapped[List["ListingRoomType"]] = relationship("ListingRoomType", back_populates="listing", lazy="selectin")


class ListingImage(Base):
    __tablename__ = "listing_images"

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=func.gen_random_uuid())
    listing_id: Mapped[str] = mapped_column(String, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    r2_url: Mapped[str] = mapped_column(String, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    listing: Mapped[Listing] = relationship("Listing", back_populates="images")


class ListingRoomType(Base):
    __tablename__ = "listing_room_types"

    id: Mapped[str] = mapped_column(String, primary_key=True, server_default=func.gen_random_uuid())
    listing_id: Mapped[str] = mapped_column(String, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    room_type: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Numeric, nullable=False)
    is_available: Mapped[bool] = mapped_column(BOOLEAN, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    listing: Mapped[Listing] = relationship("Listing", back_populates="room_types")
