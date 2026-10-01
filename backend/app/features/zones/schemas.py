from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CampusZoneRead(BaseModel):
    id: str
    campus_id: str
    name: str
    slug: str
    distance_category: Optional[str] = None
    full_search_price: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TourPriceRead(BaseModel):
    price: Optional[int] = None


class ZoneWrite(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    full_search_price: int = Field(..., ge=0)
    distance_category: Optional[str] = Field(None, max_length=60)


class ZoneCreate(ZoneWrite):
    campus_id: str
