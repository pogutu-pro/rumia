from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class AdminOverview(BaseModel):
    active_listings: int
    monthly_leads: int
    pending_commissions_kes: float
    active_agents: int
    total_campuses: int
    total_regions: int
    total_managers: int
    support_agents: int
    official_hostels: int


class AdminUserRow(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    role: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    has_agent: bool
    agent_name: Optional[str] = None
    agent_status: Optional[str] = None
    agent_slug: Optional[str] = None


class AdminAgentRow(BaseModel):
    id: str
    name: str
    phone: str
    whatsapp: str
    status: str
    created_at: datetime
    user_id: str
    active_listings_count: int
    total_leads_count: int
    pending_commissions_sum: float
    role: str
    is_featured: bool
    is_founder: bool


class AdminAgentDetailAgent(BaseModel):
    id: str
    name: str
    phone: str
    whatsapp: str
    status: str
    verified: bool
    created_at: datetime
    user_id: Optional[str] = None
    role: Optional[str] = None


class TitleRef(BaseModel):
    id: str
    title: str


class AdminAgentListing(BaseModel):
    id: str
    title: str
    location: str
    price: float
    is_active: bool


class AdminAgentLead(BaseModel):
    id: str
    clicked_at: datetime
    listing_id: str
    listings: Optional[TitleRef] = None


class AdminAgentCommission(BaseModel):
    id: str
    amount: float
    status: str
    created_at: datetime
    paid_at: Optional[datetime] = None
    listing_id: str
    listings: Optional[TitleRef] = None


class AdminAgentDetail(BaseModel):
    agent: AdminAgentDetailAgent
    listings: List[AdminAgentListing]
    leads: List[AdminAgentLead]
    commissions: List[AdminAgentCommission]


class AgentCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., min_length=7, max_length=40)
    whatsapp: str = Field(..., min_length=7, max_length=40)


class AgentPromoteRequest(AgentCreateRequest):
    user_id: str


class AgentPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    phone: Optional[str] = Field(None, min_length=7, max_length=40)
    whatsapp: Optional[str] = Field(None, min_length=7, max_length=40)


class AgentFlags(BaseModel):
    is_featured: Optional[bool] = None
    is_founder: Optional[bool] = None
    verified: Optional[bool] = None


class AgentSupportPatch(BaseModel):
    is_support: Optional[bool] = None
    support_rank: Optional[int] = Field(None, ge=0)
    is_owner: Optional[bool] = None


class AgentVerificationResult(BaseModel):
    verified: bool
    matched_hostels: List[str]
    shared_contact_detected: bool


class SupportAgentRow(BaseModel):
    id: str
    name: str
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = None
    verified: bool
    whatsapp: str
    phone: str
    slug: Optional[str] = None
    status: str
    is_featured: bool
    is_founder: bool
    is_support: bool
    support_rank: int
    is_owner: bool


class RoleChange(BaseModel):
    role: str = Field(..., pattern="^(student|agent)$")


class AdminListingRow(BaseModel):
    id: str
    title: str
    location: str
    price: float
    is_active: bool
    verified: bool
    created_at: datetime
    sort_position: Optional[int] = None
    leads_count: int
    agent_name: str
    agent_id: str
    cover_image: Optional[str] = None
    landlord_phone: Optional[str] = None
    pays_commission: bool
    commission_locked_by_admin: bool


class AgentOption(BaseModel):
    id: str
    name: str
    status: Optional[str] = None


class AdminListingsPage(BaseModel):
    listings: List[AdminListingRow]
    agents: List[AgentOption]
    last_reorder_at: Optional[datetime] = None
    has_custom_order: bool


class OrderUpdate(BaseModel):
    id: str
    sort_position: Optional[int] = None


class ListingOrderRequest(BaseModel):
    updates: List[OrderUpdate]


class ListingVerificationResult(BaseModel):
    verified: bool
    match_type: str
    matched_hostel: Optional[str] = None
    flags: List[str]


class VerifyAllSummary(BaseModel):
    total: int
    matched: int
    phone_verified: int
    name_review: int
    no_match: int
    shared_contacts: int
    official_no_listing: int


class VerifiedToggle(BaseModel):
    verified: bool


class CommissionLockToggle(BaseModel):
    locked: bool


class AdminLeadRow(BaseModel):
    id: str
    agent_id: Optional[str] = None
    listing_id: Optional[str] = None
    clicked_at: datetime
    ip_hash: Optional[str] = None
    contact_type: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    listings: Optional[TitleRef] = None
    agents: Optional[AgentOption] = None


class AdminLeadsPage(BaseModel):
    leads: List[AdminLeadRow]
    agents: List[AgentOption]
    listings: List[TitleRef]


class ListingLeadRow(BaseModel):
    id: str
    name: Optional[str] = None
    phone: Optional[str] = None
    contact_type: Optional[str] = None
    clicked_at: datetime
    agent_id: Optional[str] = None


class ListingLeadsPage(BaseModel):
    listing: dict
    leads: List[ListingLeadRow]
    agent_names: dict


class AdminCommissionRow(BaseModel):
    id: str
    agent_id: Optional[str] = None
    amount: float
    status: str
    created_at: datetime
    paid_at: Optional[datetime] = None
    agents: Optional[AgentOption] = None
    listings: Optional[TitleRef] = None


class AdminCommissionsPage(BaseModel):
    commissions: List[AdminCommissionRow]
    agents: List[AgentOption]
    total_pending: float
    total_paid: float


class CommissionCreate(BaseModel):
    agent_id: str
    listing_id: str
    amount: float = Field(..., gt=0)


class TransferRow(BaseModel):
    id: str
    listing_id: str
    previous_owner_id: str
    new_owner_id: str
    transferred_by: str
    transferred_at: datetime
    listing_title: str
    previous_owner_name: str
    new_owner_name: str


class AdminAnalytics(BaseModel):
    summary: dict
    total_students: int
    top_listings: List[dict]
    top_agents: List[dict]


class RegionWithCampuses(BaseModel):
    regions: List[dict]
    campuses: List[dict]
