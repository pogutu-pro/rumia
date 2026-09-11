from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BedConfig(BaseModel):
    type: str = Field(..., description="e.g. Queen, Double, Single, Sofa bed")
    qty: int = Field(..., ge=1)


class HouseRules(BaseModel):
    smoking: bool = False
    pets: bool = False
    parties: bool = False
    visitors: bool = True
    children: bool = True
    quiet_hours: Optional[str] = None  # e.g. "22:00-07:00"


class BnbDetailsRead(BaseModel):
    listing_id: str
    listing_type: str
    max_guests: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    bed_config: List[Dict[str, Any]] = []
    price_unit: str
    min_stay_nights: int
    max_stay_nights: Optional[int] = None
    cleaning_fee: Optional[float] = None
    security_deposit: Optional[float] = None
    extra_guest_fee: Optional[float] = None
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    advance_notice_hours: Optional[int] = None
    house_rules: Dict[str, Any] = {}
    custom_rules: Optional[str] = None
    guest_suitability: List[str] = []
    nearby_landmark: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Shared fields for create and update
class _BnbDetailsBase(BaseModel):
    listing_type: str = Field(
        default="entire_place",
        pattern="^(entire_place|private_room|shared_space)$",
    )
    max_guests: Optional[int] = Field(None, ge=1, le=50)
    bedrooms: Optional[int] = Field(None, ge=0, le=20)
    bathrooms: Optional[int] = Field(None, ge=0, le=20)
    bed_config: List[BedConfig] = []
    price_unit: str = Field(
        default="night",
        pattern="^(night|week|month)$",
    )
    min_stay_nights: int = Field(default=1, ge=1)
    max_stay_nights: Optional[int] = Field(None, ge=1)
    cleaning_fee: Optional[float] = Field(None, ge=0)
    security_deposit: Optional[float] = Field(None, ge=0)
    extra_guest_fee: Optional[float] = Field(None, ge=0)
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    advance_notice_hours: Optional[int] = Field(None, ge=0)
    house_rules: HouseRules = Field(default_factory=HouseRules)
    custom_rules: Optional[str] = Field(None, max_length=1000)
    guest_suitability: List[str] = []
    nearby_landmark: Optional[str] = Field(None, max_length=200)


class BnbListingCreate(BaseModel):
    """Full payload to create a BnB listing (listing + bnb_details in one call)."""
    # Listing fields
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10)
    price: float = Field(..., ge=0, description="Base price in the chosen price_unit")
    location: str = Field(..., min_length=2)
    county: Optional[str] = None
    area: Optional[str] = None
    specific_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    amenities: List[str] = []
    is_active: bool = True
    images: List[Dict[str, Any]] = []
    agent_whatsapp: Optional[str] = None

    # BnB-specific fields
    bnb: _BnbDetailsBase = Field(default_factory=_BnbDetailsBase)


class BnbListingUpdate(BaseModel):
    """Partial update for a BnB listing."""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=10)
    price: Optional[float] = Field(None, ge=0)
    location: Optional[str] = None
    county: Optional[str] = None
    area: Optional[str] = None
    specific_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    amenities: Optional[List[str]] = None
    is_active: Optional[bool] = None
    images: Optional[List[Dict[str, Any]]] = None
    agent_whatsapp: Optional[str] = None

    # BnB-specific fields (all optional for partial update)
    listing_type: Optional[str] = Field(None, pattern="^(entire_place|private_room|shared_space)$")
    max_guests: Optional[int] = Field(None, ge=1, le=50)
    bedrooms: Optional[int] = Field(None, ge=0, le=20)
    bathrooms: Optional[int] = Field(None, ge=0, le=20)
    bed_config: Optional[List[BedConfig]] = None
    price_unit: Optional[str] = Field(None, pattern="^(night|week|month)$")
    min_stay_nights: Optional[int] = Field(None, ge=1)
    max_stay_nights: Optional[int] = Field(None, ge=1)
    cleaning_fee: Optional[float] = Field(None, ge=0)
    security_deposit: Optional[float] = Field(None, ge=0)
    extra_guest_fee: Optional[float] = Field(None, ge=0)
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    advance_notice_hours: Optional[int] = Field(None, ge=0)
    house_rules: Optional[HouseRules] = None
    custom_rules: Optional[str] = Field(None, max_length=1000)
    guest_suitability: Optional[List[str]] = None
    nearby_landmark: Optional[str] = Field(None, max_length=200)


class BnbListingRead(BaseModel):
    """Combined listing + bnb_details response."""
    # Core listing fields
    id: str
    title: str
    slug: Optional[str] = None
    description: str
    property_type: str
    price: float
    location: str
    county: Optional[str] = None
    area: Optional[str] = None
    specific_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    amenities: Optional[List[str]] = None
    is_active: bool
    is_saved: bool = False
    rating: float = 0.0
    views: int = 0
    agent_id: str
    campus_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    images: List[Dict[str, Any]] = []
    agent: Optional[Dict[str, Any]] = None

    # BnB details (None if not yet created)
    bnb: Optional[BnbDetailsRead] = None

    model_config = ConfigDict(from_attributes=True)
