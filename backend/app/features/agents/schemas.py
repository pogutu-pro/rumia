from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


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
