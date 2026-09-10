from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


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
    campus_id: str
    campus_name: str


class SavedHostelActionResponse(BaseModel):
    message: str
    is_saved: bool
    listing_id: str


class WishlistActionResponse(BaseModel):
    message: str
    is_saved: bool
    listing_id: str

