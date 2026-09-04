from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    listing_id: Optional[str] = None
    content: str = Field(..., min_length=5)
    user_email: Optional[str] = None


class FeedbackRead(BaseModel):
    id: str
    listing_id: Optional[str] = None
    content: str
    user_email: Optional[str] = None
    user_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
