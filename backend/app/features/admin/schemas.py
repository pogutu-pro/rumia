from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class CampusCreate(BaseModel):
    slug: str = Field(..., min_length=2)
    name: str = Field(..., min_length=2)
    city: str
    hero_headline: str
    hero_subtext: Optional[str] = None
    whatsapp_number: str
    primary_color: str = "#000000"
    feature_flags: Dict[str, Any] = {}
    region_id: Optional[str] = None
    hero_image: Optional[str] = None
    status: str = Field("active", pattern="^(active|coming_soon|suspended)$")


class CampusUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = Field(None, min_length=2)
    region_id: Optional[str] = None
    city: Optional[str] = None
    hero_headline: Optional[str] = None
    hero_subtext: Optional[str] = None
    whatsapp_number: Optional[str] = None
    primary_color: Optional[str] = None
    feature_flags: Optional[Dict[str, Any]] = None
    status: Optional[str] = Field(None, pattern="^(active|coming_soon|suspended)$")


class CampusStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|coming_soon|suspended)$")


class ManagerRead(BaseModel):
    id: str
    email: Optional[str] = None
    role: str
    managed_campus_id: Optional[str] = None
    managed_region_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ManagerAssign(BaseModel):
    user_id: str
    managed_campus_id: Optional[str] = None
    managed_region_id: Optional[str] = None


class AgentStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|suspended)$")


class ListingTransferRequest(BaseModel):
    listing_id: str
    new_agent_id: str


class PlatformStats(BaseModel):
    total_listings: int
    active_listings: int
    total_agents: int
    total_students: int
