from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ProfileRead(BaseModel):
    id: str
    email: Optional[str] = None
    role: str = "student"
    campus_id: Optional[str] = None
    home_campus_id: Optional[str] = None
    managed_campus_id: Optional[str] = None
    managed_region_id: Optional[str] = None
    home_campus_name: Optional[str] = None
    home_campus_confirmed: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    home_campus_id: Optional[str] = None
    home_campus_name: Optional[str] = None
    home_campus_confirmed: Optional[bool] = None


class SetHomeCampusRequest(BaseModel):
    campus_id: str
    campus_name: str
