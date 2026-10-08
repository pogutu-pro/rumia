from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class MarketRead(BaseModel):
    slug: str
    name: str
    status: str
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None


class PlaceRead(BaseModel):
    slug: str
    name: str
    kind: str
    aliases: List[str] = []
    lat: Optional[float] = None
    lng: Optional[float] = None
    listing_count: int = 0


class LandmarkRead(BaseModel):
    slug: str
    name: str
    kind: str
    aliases: List[str] = []
    lat: float
    lng: float
    features: Dict[str, Any] = {}
