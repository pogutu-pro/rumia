from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.features.listings.schemas import ListingRead


class AgentRead(BaseModel):
    id: str
    name: str
    phone: str
    whatsapp: str
    status: str
    campus_id: Optional[str] = None
    user_id: Optional[str] = None
    portfolio_url: Optional[str] = None
    is_featured: bool = False
    is_founder: bool = False
    is_support: bool = False
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    bio: Optional[str] = None
    portfolio_url: Optional[str] = None
    profile_photo_url: Optional[str] = None
    profile_image_url: Optional[str] = None


class AgentApplicationCreate(BaseModel):
    campus_id: str
    full_name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=8)
    id_number: str = Field(..., min_length=4)
    hostel_name: str = Field(..., min_length=2)
    relationship_to_hostel: str
    owner_contact: Optional[str] = None


class AgentApplicationReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    rejection_reason: Optional[str] = None


class AgentApplicationRead(BaseModel):
    id: str
    user_id: str
    campus_id: str
    full_name: str
    phone: str
    id_number: str
    hostel_name: str
    relationship_to_hostel: str
    owner_contact: Optional[str] = None
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentSelfRead(BaseModel):
    """An agent's own record, including private fields (balance, payment details)."""

    id: str
    user_id: Optional[str] = None
    campus_id: Optional[str] = None
    name: str
    phone: str
    whatsapp: str
    slug: Optional[str] = None
    status: str
    suspension_reason: Optional[str] = None
    commission_balance: float = 0.0
    pochi_la_biashara_number: Optional[str] = None
    expected_name: Optional[str] = None
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    service_areas: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    helping_since: Optional[int] = None
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    instagram_public: Optional[bool] = None
    linkedin_public: Optional[bool] = None
    portfolio_url: Optional[str] = None
    verified: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_founder: Optional[bool] = None
    is_support: Optional[bool] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentDashboardRead(BaseModel):
    """Headline numbers for the agent dashboard home."""

    agent: AgentSelfRead
    has_payment_details: bool
    listing_count: int
    active_listing_count: int
    leads_this_month: int
    total_leads: int
    pending_tours: int
    tour_earnings: float


class AgentListingRead(ListingRead):
    """A listing as shown in its owner's dashboard."""

    lead_count: int = 0
    commission_locked_by_admin: bool = False
