from datetime import datetime
from typing import Any, Dict, List, Optional
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
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: List[str] = Field(default_factory=list)
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    twitter_description: Optional[str] = None
    manifest_name: Optional[str] = None
    manifest_description: Optional[str] = None
    short_name: Optional[str] = None
    hero_image: Optional[str] = None
    hostel_finding_fee: Optional[float] = None
    consultation_fee: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
