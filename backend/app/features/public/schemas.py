from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class PublicAgent(BaseModel):
    """What the public may see of an agent. Deliberately excludes id numbers, owner contacts,
    commission balance, application details and the linked user id."""

    id: str
    slug: Optional[str] = None
    name: str
    phone: str
    whatsapp: str
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    service_areas: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    helping_since: Optional[int] = None
    portfolio_url: Optional[str] = None
    verified: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_founder: Optional[bool] = None
    is_owner: Optional[bool] = None
    support_rank: Optional[int] = None
    # Social links only when the agent chose to make them public.
    instagram: Optional[str] = None
    linkedin: Optional[str] = None
    instagram_public: Optional[bool] = None
    linkedin_public: Optional[bool] = None
    # Shown in the fee-payment step of the contact flow.
    pochi_la_biashara_number: Optional[str] = None
    expected_name: Optional[str] = None
    campus_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VerifyCandidate(BaseModel):
    """A listing's contact/payment identifiers, used by the 'Hakikisha' verify-before-you-pay checker."""

    id: str
    title: str
    county: Optional[str] = None
    area: Optional[str] = None
    slug: Optional[str] = None
    landlord_phone: Optional[str] = None
    agent_phone: Optional[str] = None
    agent_whatsapp: Optional[str] = None
    agent_verified: Optional[bool] = None
    verified: Optional[bool] = None
    mpesa_details: Optional[str] = None
    specific_location: Optional[str] = None


class SitemapListing(BaseModel):
    slug: str
    county: Optional[str] = None
    area: Optional[str] = None
    updated_at: Optional[datetime] = None


class SitemapAgent(BaseModel):
    slug: str
    updated_at: Optional[datetime] = None


class SitemapResponse(BaseModel):
    listings: List[SitemapListing]
    agents: List[SitemapAgent]
