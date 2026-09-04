from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class CampusRead(BaseModel):
    id: str
    slug: str
    name: str
    city: str
    hero_headline: str
    hero_subtext: Optional[str] = None
    whatsapp_number: str
    primary_color: str
    feature_flags: Dict[str, Any] = Field(default_factory=dict)
    status: str
    region_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
