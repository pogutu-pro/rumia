from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class UnitRead(BaseModel):
    id: str
    unit_kind: str
    label: Optional[str] = None
    price_amount: float
    price_period: str
    deposit_amount: Optional[float] = None
    move_in_total: Optional[float] = None
    count_available: int
    bathroom: Optional[str] = None
    furnished: str = "none"
    sharing: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    gender_policy: str = "any"
    min_stay: Optional[int] = None
    max_guests: Optional[int] = None


class MediaRead(BaseModel):
    id: str
    kind: str
    source: str
    url: Optional[str] = None
    external_id: Optional[str] = None
    variants: Dict[str, Any] = {}
    width: Optional[int] = None
    height: Optional[int] = None
    blur_data_url: Optional[str] = None
    room_tag: str = "other"
    position: int = 0
    is_cover: bool = False


class FactRead(BaseModel):
    kind: str  # availability | visit | registry | contact
    text: str
    observed_at: Optional[datetime] = None


class LandmarkDistance(BaseModel):
    slug: str
    name: str
    kind: str
    walk_min: int


class OrgBrief(BaseModel):
    name: str
    slug: str


class PropertyRead(BaseModel):
    id: str
    listing_id: Optional[str] = None
    slug: str
    name: str
    kind: str
    status: str
    market_slug: Optional[str] = None
    place_slug: Optional[str] = None
    place_name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_precision: str = "approximate"
    address_hint: Optional[str] = None
    description: Optional[str] = None
    amenities: List[str] = []
    included_utilities: List[str] = []
    house_rules: Dict[str, Any] = {}
    audience: List[str] = []
    tier: Optional[str] = None
    from_price: Optional[float] = None
    from_price_period: Optional[str] = None
    last_confirmed_at: Optional[datetime] = None
    facts: List[FactRead] = []
    units: List[UnitRead] = []
    media: List[MediaRead] = []
    landmarks: List[LandmarkDistance] = []
    org: Optional[OrgBrief] = None


class StatusChange(BaseModel):
    reason: Optional[str] = None


class ActionPreview(BaseModel):
    action: str
    property_name: str
    property_slug: str
    current_status: str


class ActionResult(BaseModel):
    action: str
    status: str


class ReportCreate(BaseModel):
    reason: str
    details: Optional[str] = None
