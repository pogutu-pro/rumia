from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class LeadTrackRequest(BaseModel):
    listing_id: str
    ip_hash: str
    source: str = "whatsapp"


class LeadRead(BaseModel):
    id: str
    listing_id: str
    agent_id: str
    clicked_at: datetime
    ip_hash: str
    source: str
    user_id: Optional[str] = None
    campus_id: Optional[str] = None

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
