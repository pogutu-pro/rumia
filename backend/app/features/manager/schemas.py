from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.features.agents.schemas import AgentApplicationRead
from app.features.hostel_requests.schemas import HostelRequestCampus


class ManagerContext(BaseModel):
    user_id: str
    role: str
    is_super_admin: bool
    managed_campus_id: Optional[str] = None
    managed_region_id: Optional[str] = None
    campus_name: str
    user_name: str
    user_email: Optional[str] = None
    has_agent_record: bool


class ManagerOverview(BaseModel):
    """Counts for the manager home page, limited to the campuses in scope."""

    has_campuses: bool
    pending_applications: int
    agents: int
    listings: int
    waiting_hostel_requests: int
    official_hostels: int


class ManagedApplicationRead(AgentApplicationRead):
    campus: Optional[HostelRequestCampus] = None


class ApplicationRejection(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000)


class ManagedAgentRead(BaseModel):
    id: str
    user_id: Optional[str] = None
    campus_id: Optional[str] = None
    name: str
    phone: str
    whatsapp: str
    status: str
    verified: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_founder: Optional[bool] = None
    slug: Optional[str] = None
    created_at: datetime
    campus: Optional[HostelRequestCampus] = None

    model_config = ConfigDict(from_attributes=True)


class AgentStandingUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|suspended)$")
    suspension_reason: Optional[str] = Field(None, max_length=1000)


class ManagedListingAgent(BaseModel):
    id: str
    name: str
    user_id: Optional[str] = None


class ManagedListingImage(BaseModel):
    r2_url: str
    display_order: int = 0


class ManagedListingRead(BaseModel):
    id: str
    slug: Optional[str] = None
    title: str
    price: float
    location: str
    area: Optional[str] = None
    county: Optional[str] = None
    campus_id: Optional[str] = None
    is_active: bool
    verified: bool = False
    pays_commission: bool = False
    commission_locked_by_admin: bool = False
    landlord_phone: Optional[str] = None
    created_at: datetime
    images: List[ManagedListingImage] = []
    agent: Optional[ManagedListingAgent] = None
    lead_count: int = 0
    campus: Optional[HostelRequestCampus] = None


class OwnerPhoneUpdate(BaseModel):
    landlord_phone: Optional[str] = Field(None, max_length=40)


class StaffMember(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    managed_campus_id: Optional[str] = None
    managed_region_id: Optional[str] = None


class ManagerAssignment(BaseModel):
    managed_campus_id: Optional[str] = None
    managed_region_id: Optional[str] = None


class FoundUser(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None


class PromotableAgent(BaseModel):
    id: str
    email: str
    full_name: str
    campus_name: str


class CampusSettingsUpdate(BaseModel):
    """Fields a manager may change on a campus they manage. `name/slug/region_id/status` are admin-only
    (silently ignored for managers). Only the fields actually sent are applied (null clears)."""

    phone: Optional[str] = None
    email: Optional[str] = None
    social_links: Optional[dict] = None
    whatsapp_number: Optional[str] = None
    hero_headline: Optional[str] = None
    hero_subtext: Optional[str] = None
    primary_color: Optional[str] = None
    short_name: Optional[str] = None
    hero_image: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    twitter_description: Optional[str] = None
    hostel_finding_fee: Optional[float] = Field(None, ge=0)
    consultation_fee: Optional[float] = Field(None, ge=0)
    # admin only
    name: Optional[str] = None
    slug: Optional[str] = None
    region_id: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(active|coming_soon)$")


class CampusQuickCreate(BaseModel):
    """Minimal campus creation: it starts as 'coming_soon' with placeholder branding to refine later."""

    name: str = Field(..., min_length=2, max_length=120)
    slug: Optional[str] = Field(None, max_length=60)
    region_id: Optional[str] = None
    hero_image: Optional[str] = None


class ManagedAnnouncementRead(BaseModel):
    id: str
    campus_id: str
    title: str
    message: str
    type: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    campus: Optional[HostelRequestCampus] = None
