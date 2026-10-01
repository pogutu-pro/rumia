from datetime import datetime
from typing import List, Optional
from sqlalchemy import ARRAY, BOOLEAN, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.core.database import Base


class Agent(Base):
    __tablename__ = "agents"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    whatsapp: Mapped[str] = mapped_column(String, nullable=False)
    commission_balance: Mapped[float] = mapped_column(Numeric, server_default="0")
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="active")
    slug: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pochi_la_biashara_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    expected_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    campus_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("campuses.id"), nullable=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        Index(
            "idx_listings_campus_active_type",
            "campus_id",
            "is_active",
            "property_type",
        ),
    )

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid())
    title: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    property_type: Mapped[str] = mapped_column(String, server_default="hostel", index=True)
    price: Mapped[float] = mapped_column(Numeric, nullable=False)
    location: Mapped[str] = mapped_column(String, nullable=False)
    county: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    area: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    specific_location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    landlord_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    youtube_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_youtube_shorts: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    is_full: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    sort_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), server_default="0.0")
    views: Mapped[int] = mapped_column(Integer, server_default="0")
    verified: Mapped[Optional[bool]] = mapped_column(BOOLEAN, server_default="false", nullable=True)
    commission_locked_by_admin: Mapped[Optional[bool]] = mapped_column(BOOLEAN, server_default="false", nullable=True)
    bathroom_type: Mapped[Optional[str]] = mapped_column(String, server_default="Shared")
    distance_to_campus: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    distance_category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    security_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    electricity_included: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    water_included: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    wifi_included: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    hot_water_included: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    cooking_gas_included: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    room_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    price_single: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    price_sharing: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    room_type_enum: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mpesa_details: Mapped[Optional[dict]] = mapped_column(String, nullable=True) # It's a text/json in DB, treating as string here maybe or leave as dict if JSONB
    pays_commission: Mapped[bool] = mapped_column(BOOLEAN, server_default="false")
    amenities: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), server_default="{}")
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    agent_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    campus_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("campuses.id"), nullable=True, index=True)
    zone_id: Mapped[Optional[str]] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("campus_zones.id"), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(BOOLEAN, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    agent: Mapped[Agent] = relationship("Agent", lazy="selectin")
    images: Mapped[List["ListingImage"]] = relationship("ListingImage", back_populates="listing", lazy="selectin", order_by="ListingImage.display_order.asc()")
    room_types: Mapped[List["ListingRoomType"]] = relationship("ListingRoomType", back_populates="listing", lazy="selectin")


class ListingImage(Base):
    __tablename__ = "listing_images"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid())
    listing_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    image_upload_id: Mapped[Optional[str]] = mapped_column(
        PG_UUID(as_uuid=False),
        ForeignKey("image_uploads.id", ondelete="SET NULL"),
        nullable=True,
    )
    r2_url: Mapped[str] = mapped_column(String, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, server_default="0")
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    blur_data_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    format: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    listing: Mapped[Listing] = relationship("Listing", back_populates="images")


class ListingRoomType(Base):
    __tablename__ = "listing_room_types"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid())
    listing_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    room_type: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Numeric, nullable=False)
    deposit: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    is_available: Mapped[bool] = mapped_column(BOOLEAN, server_default="true")
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    occupancy: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    floor: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    furnishing_items: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    listing: Mapped[Listing] = relationship("Listing", back_populates="room_types")
