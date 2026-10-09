from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class SearchFlags(BaseModel):
    visited: bool = False
    registry: bool = False
    has_video: bool = False


class SearchCard(BaseModel):
    id: str
    listing_id: Optional[str] = None  # legacy listing id; saves and contacts still key on it
    slug: str
    name: str
    kind: str
    status: str
    place_name: Optional[str] = None
    cover_url: Optional[str] = None
    cover_blur: Optional[str] = None
    from_price: Optional[float] = None
    price_period: Optional[str] = None
    unit_kind: Optional[str] = None
    move_in_total: Optional[float] = None
    walk_min: Optional[int] = None
    walk_to: Optional[str] = None
    freshness: Optional[str] = None
    flags: SearchFlags = SearchFlags()
    reason: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class Relaxation(BaseModel):
    label: str
    count: int
    change: Dict[str, Any]


class SearchResponse(BaseModel):
    items: List[SearchCard]
    total: int
    next_cursor: Optional[str] = None
    chips: List[Dict[str, str]] = []
    relaxations: List[Relaxation] = []
    applied: Dict[str, Any] = {}


class SimilarResponse(BaseModel):
    items: List[SearchCard]


class AlertCreate(BaseModel):
    intent: Dict[str, Any]
    label: Optional[str] = Field(None, max_length=120)
    channel: Literal["email", "whatsapp"]
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=30)
    frequency: Literal["instant", "daily", "weekly"] = "daily"


class AlertRead(BaseModel):
    id: str
    label: Optional[str] = None
    intent: Dict[str, Any]
    channel: str
    frequency: str
    active: bool
    created_at: datetime
