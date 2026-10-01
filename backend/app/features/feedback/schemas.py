from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

FEEDBACK_CATEGORIES = "^(suggest_hostel|feature_request|report_problem|general)$"


class FeedbackCreate(BaseModel):
    category: str = Field(..., pattern=FEEDBACK_CATEGORIES)
    message: str = Field(..., min_length=5, max_length=5000)


class FeedbackRead(BaseModel):
    id: str
    user_id: str
    category: str
    message: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
