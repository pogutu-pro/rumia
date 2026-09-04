from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class LegalDocRead(BaseModel):
    id: str
    type: str
    content: str
    status: str
    effective_date: Optional[date] = None
    published_at: Optional[datetime] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LegalDocAdminRead(BaseModel):
    id: str
    type: str
    content: str
    draft_content: Optional[str] = None
    status: str
    effective_date: Optional[date] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    updated_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LegalDraftUpdate(BaseModel):
    draft_content: str
