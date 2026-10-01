from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

ContactType = Literal["rumia_agent", "hostel_owner"]


class LeadTrackRequest(BaseModel):
    listing_id: str
    # Ignored for attribution: the agent is always the listing's own agent.
    agent_id: Optional[str] = None
    contact_type: ContactType = "rumia_agent"
    name: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=40)
    # The student has seen the consultation-fee disclosure for a Rumia agent.
    fee_accepted: bool = False


class LeadContactAgent(BaseModel):
    name: Optional[str] = None
    whatsapp: Optional[str] = None
    phone: Optional[str] = None
    pochi_la_biashara_number: Optional[str] = None
    expected_name: Optional[str] = None


class LeadContactListing(BaseModel):
    title: str
    price: float
    room_type: Optional[str] = None
    area: Optional[str] = None
    slug: Optional[str] = None
    county: Optional[str] = None
    has_video: bool = False
    is_full: bool = False
    pays_commission: bool = False
    # Only populated for contact_type == "hostel_owner".
    landlord_phone: Optional[str] = None


class LeadTrackResult(BaseModel):
    """What the caller needs to open the right WhatsApp chat after a lead is recorded."""

    recorded: bool  # False when the same visitor already clicked this listing in the last 24h
    contact_type: ContactType
    agent: LeadContactAgent
    listing: LeadContactListing
    consultation_fee: Optional[float] = None


class LeadRead(BaseModel):
    id: str
    listing_id: str
    agent_id: str
    clicked_at: datetime
    contact_type: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CommissionRead(BaseModel):
    id: str
    agent_id: str
    listing_id: str
    amount: float
    status: str
    paid_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
