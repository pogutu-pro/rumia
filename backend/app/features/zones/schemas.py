from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


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
