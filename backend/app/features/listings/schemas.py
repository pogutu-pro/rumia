from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AgentRead(BaseModel):
    id: str
    name: str
    phone: str
    whatsapp: str
    status: str
    campus_id: Optional[str] = None
    slug: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ListingImageRead(BaseModel):
    id: str
    r2_url: str
    image_upload_id: Optional[str] = None
    display_order: int
    category: Optional[str] = None
    blur_data_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    format: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ListingImageCreate(BaseModel):
    r2_url: str
    image_upload_id: Optional[str] = None
    display_order: int = 0
    category: Optional[str] = None
    blur_data_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    format: Optional[str] = None


class ListingRoomTypeRead(BaseModel):
    id: str
    room_type: str
    price: float
    is_available: bool
    deposit: Optional[float] = None
    furnishing_items: Optional[List[str]] = None
    category: Optional[str] = None
    occupancy: Optional[str] = None
    floor: Optional[str] = None
    size: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ListingRoomTypeCreate(BaseModel):
    room_type: str
    price: float
    is_available: bool = True
    deposit: Optional[float] = None
    furnishing_items: List[str] = []
    category: Optional[str] = None
    occupancy: Optional[str] = None
    floor: Optional[str] = None
    size: Optional[str] = None


class ListingRead(BaseModel):
    id: str
    title: str
    slug: Optional[str] = None
    description: str
    property_type: str = "hostel"
    price: float
    location: str
    county: Optional[str] = None
    area: Optional[str] = None
    specific_location: Optional[str] = None
    landlord_phone: Optional[str] = None
    mpesa_details: Optional[str] = None
    proximity_description: Optional[str] = None
    youtube_id: Optional[str] = None
    is_youtube_shorts: bool = False
    is_full: bool = False
    sort_position: Optional[int] = None
    rating: float = 0.0
    views: int = 0
    bathroom_type: Optional[str] = None
    distance_to_campus: Optional[str] = None
    distance_category: Optional[str] = None
    security_type: Optional[str] = None
    electricity_included: bool = False
    water_included: bool = False
    wifi_included: bool = False
    hot_water_included: bool = False
    cooking_gas_included: bool = False
    room_type: Optional[str] = None
    room_type_enum: Optional[str] = None
    gender: Optional[str] = None
    price_single: Optional[float] = None
    price_sharing: Optional[float] = None
    pays_commission: bool = False
    amenities: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    campus_id: Optional[str] = None
    zone_id: Optional[str] = None
    is_active: bool = True
    is_saved: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    agent: Optional[AgentRead] = None
    images: List[ListingImageRead] = []
    room_types: List[ListingRoomTypeRead] = []

    model_config = ConfigDict(from_attributes=True)


class ListingCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10)
    property_type: str = Field(default="hostel", pattern="^(hostel|apartment|short_stay)$")
    price: float = Field(..., ge=0)
    location: str = Field(..., min_length=2)
    county: Optional[str] = "nyeri"
    area: Optional[str] = "dekut"
    specific_location: Optional[str] = None
    landlord_phone: Optional[str] = None
    mpesa_details: Optional[str] = None
    proximity_description: Optional[str] = None
    youtube_id: Optional[str] = None
    is_youtube_shorts: bool = False
    bathroom_type: Optional[str] = "Shared"
    distance_to_campus: Optional[str] = None
    distance_category: Optional[str] = None
    security_type: Optional[str] = None
    electricity_included: bool = False
    water_included: bool = False
    wifi_included: bool = False
    hot_water_included: bool = False
    cooking_gas_included: bool = False
    room_type: Optional[str] = None
    gender: Optional[str] = "mixed"
    price_single: Optional[float] = None
    price_sharing: Optional[float] = None
    pays_commission: bool = False
    amenities: List[str] = []
    is_active: bool = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    campus_id: Optional[str] = None
    zone_id: Optional[str] = None
    room_types: List[ListingRoomTypeCreate] = []
    images: List[ListingImageCreate] = []
    # Legacy field — still accepted for backward compat but images takes priority
    image_urls: List[str] = []
    # Agent WhatsApp override (updated on agent row during create/update)
    agent_whatsapp: Optional[str] = None


class ListingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=10)
    property_type: Optional[str] = Field(None, pattern="^(hostel|apartment|short_stay)$")
    price: Optional[float] = Field(None, ge=0)
    location: Optional[str] = None
    county: Optional[str] = None
    area: Optional[str] = None
    specific_location: Optional[str] = None
    landlord_phone: Optional[str] = None
    mpesa_details: Optional[str] = None
    proximity_description: Optional[str] = None
    youtube_id: Optional[str] = None
    is_youtube_shorts: Optional[bool] = None
    is_full: Optional[bool] = None
    is_active: Optional[bool] = None
    bathroom_type: Optional[str] = None
    distance_to_campus: Optional[str] = None
    distance_category: Optional[str] = None
    security_type: Optional[str] = None
    electricity_included: Optional[bool] = None
    water_included: Optional[bool] = None
    wifi_included: Optional[bool] = None
    hot_water_included: Optional[bool] = None
    cooking_gas_included: Optional[bool] = None
    room_type: Optional[str] = None
    gender: Optional[str] = None
    price_single: Optional[float] = None
    price_sharing: Optional[float] = None
    pays_commission: Optional[bool] = None
    amenities: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    campus_id: Optional[str] = None
    zone_id: Optional[str] = None
    # When provided, replaces all existing images
    images: Optional[List[ListingImageCreate]] = None
    # When provided, replaces all existing room types
    room_types: Optional[List[ListingRoomTypeCreate]] = None
    # Agent WhatsApp override
    agent_whatsapp: Optional[str] = None


class ListingToggleFull(BaseModel):
    is_full: bool


class ListingToggleActive(BaseModel):
    is_active: bool


class ListingToggleCommission(BaseModel):
    pays_commission: bool
