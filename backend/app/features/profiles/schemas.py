from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProfileRead(BaseModel):
    id: str
    email: Optional[str] = None
    role: str = "student"
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    campus_id: Optional[str] = None
    home_campus_id: Optional[str] = None
    managed_campus_id: Optional[str] = None
    managed_region_id: Optional[str] = None
    home_campus_name: Optional[str] = None
    home_campus_confirmed: bool = False
    home_campus_confirmed_at: Optional[datetime] = None
    school_verified: bool = False
    # Set on GET /profiles/me when the user owns an agent record (drives post-login routing).
    agent_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    home_campus_id: Optional[str] = None
    home_campus_name: Optional[str] = None
    home_campus_confirmed: Optional[bool] = None
    home_campus_confirmed_at: Optional[datetime] = None
    campus_input: Optional[str] = None


class SetHomeCampusRequest(BaseModel):
    campus_id: UUID
    campus_name: str


class SavedHostelActionResponse(BaseModel):
    message: str
    is_saved: bool
    listing_id: str


class WishlistActionResponse(BaseModel):
    message: str
    is_saved: bool
    listing_id: str


class WishlistBatchCheckRequest(BaseModel):
    ids: list[str]


class WishlistBatchCheckResponse(BaseModel):
    """Map of listing_id → is_saved for every requested id."""
    saved: dict[str, bool]


class EmailExistsResponse(BaseModel):
    exists: bool


class LoginSyncRequest(BaseModel):
    """Display details from the OAuth provider (Google). Identity and email come from the JWT."""

    full_name: Optional[str] = Field(None, max_length=200)
    avatar_url: Optional[str] = Field(None, max_length=1000)


class LoginSyncResponse(BaseModel):
    role: str
    # Students without a phone or a confirmed home campus must finish their profile first.
    needs_profile_completion: bool
    linked_bookings: int = 0
