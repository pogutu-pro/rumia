from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AnnouncementCreate(BaseModel):
    campus_id: str
    title: str = Field(..., min_length=2)
    message: str = Field(..., min_length=5)
    type: str = Field("info", pattern="^(info|warning|encouragement)$")
    expires_at: datetime


class AnnouncementUpdate(BaseModel):
    campus_id: Optional[str] = None
    title: Optional[str] = Field(None, min_length=2)
    message: Optional[str] = Field(None, min_length=5)
    type: Optional[str] = Field(None, pattern="^(info|warning|encouragement)$")
    expires_at: Optional[datetime] = None


class AnnouncementRead(BaseModel):
    id: str
    campus_id: str
    title: str
    message: str
    type: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)
