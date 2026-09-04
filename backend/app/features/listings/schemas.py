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

    model_config = ConfigDict(from_attributes=True)


class ListingImageRead(BaseModel):
    id: str
    r2_url: str
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class ListingImageCreate(BaseModel):
    r2_url: str
    display_order: int = 0


class ListingRoomTypeRead(BaseModel):
    id: str
    room_type: str
    price: float
    is_available: bool

    model_config = ConfigDict(from_attributes=True)


class ListingRoomTypeCreate(BaseModel):
    room_type: str
    price: float
    is_available: bool = True


class ListingRead(BaseModel):
    id: str
    title: str
    slug: Optional[str] = None
    description: str
    price: float
    location: str
    county: Optional[str] = None
    area: Optional[str] = None
    specific_location: Optional[str] = None
    is_full: bool = False
    rating: float = 0.0
    views: int = 0
    bathroom_type: Optional[str] = None
    distance_to_campus: Optional[str] = None
    security_type: Optional[str] = None
    electricity_included: bool = False
    water_included: bool = False
    wifi_included: bool = False
    amenities: List[str] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    campus_id: Optional[str] = None
    zone_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime

    agent: Optional[AgentRead] = None
    images: List[ListingImageRead] = []
    room_types: List[ListingRoomTypeRead] = []

    model_config = ConfigDict(from_attributes=True)


class ListingCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10)
    price: float = Field(..., ge=0)
    location: str = Field(..., min_length=2)
    county: Optional[str] = "nyeri"
    area: Optional[str] = "dekut"
    specific_location: Optional[str] = None
    landlord_phone: Optional[str] = None
    youtube_id: Optional[str] = None
    bathroom_type: Optional[str] = "Shared"
    distance_to_campus: Optional[str] = None
    security_type: Optional[str] = None
    electricity_included: bool = False
    water_included: bool = False
    wifi_included: bool = False
    amenities: List[str] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    campus_id: Optional[str] = None
    zone_id: Optional[str] = None
    room_types: List[ListingRoomTypeCreate] = []
    image_urls: List[str] = []


class ListingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=10)
    price: Optional[float] = Field(None, ge=0)
    location: Optional[str] = None
    county: Optional[str] = None
    area: Optional[str] = None
    specific_location: Optional[str] = None
    landlord_phone: Optional[str] = None
    youtube_id: Optional[str] = None
    is_full: Optional[bool] = None
    is_active: Optional[bool] = None
    bathroom_type: Optional[str] = None
    distance_to_campus: Optional[str] = None
    security_type: Optional[str] = None
    electricity_included: Optional[bool] = None
    water_included: Optional[bool] = None
    wifi_included: Optional[bool] = None
    amenities: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    campus_id: Optional[str] = None
    zone_id: Optional[str] = None


class ListingToggleFull(BaseModel):
    is_full: bool
