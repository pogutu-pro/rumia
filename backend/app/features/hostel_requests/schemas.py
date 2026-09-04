from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

GENDERS = ("male", "female", "no_preference")
ROOM_TYPES = ("single", "shared", "bedsitter", "one_bedroom", "no_preference")
FURNISHINGS = ("furnished", "unfurnished", "no_preference")
STAY_PREFERENCES = ("alone", "sharing", "no_preference")
BUDGET_RANGES = (
    "below_3000",
    "3000_5000",
    "5000_7000",
    "7000_10000",
    "above_10000",
    "any_amount",
)
REQUEST_STATUSES = (
    "waiting",
    "contacted",
    "finding",
    "hostel_found",
    "completed",
    "cancelled",
)


class HostelRequestCreate(BaseModel):
    phone: str = Field(..., min_length=4, max_length=20)
    preferred_zone: Optional[str] = Field(None, max_length=120)
    budget_range: str = Field(..., pattern="|".join(BUDGET_RANGES))
    gender: str = Field("no_preference", pattern="|".join(GENDERS))
    room_type: str = Field("no_preference", pattern="|".join(ROOM_TYPES))
    furnishing: str = Field("no_preference", pattern="|".join(FURNISHINGS))
    stay_preference: str = Field("no_preference", pattern="|".join(STAY_PREFERENCES))
    move_in_date: Optional[date] = None
    additional_requirements: Optional[str] = Field(None, max_length=1000)


class HostelRequestUpdate(BaseModel):
    phone: Optional[str] = Field(None, min_length=4, max_length=20)
    preferred_zone: Optional[str] = Field(None, max_length=120)
    budget_range: Optional[str] = Field(None, pattern="|".join(BUDGET_RANGES))
    gender: Optional[str] = Field(None, pattern="|".join(GENDERS))
    room_type: Optional[str] = Field(None, pattern="|".join(ROOM_TYPES))
    furnishing: Optional[str] = Field(None, pattern="|".join(FURNISHINGS))
    stay_preference: Optional[str] = Field(None, pattern="|".join(STAY_PREFERENCES))
    move_in_date: Optional[date] = None
    additional_requirements: Optional[str] = Field(None, max_length=1000)


class HostelRequestRead(BaseModel):
    id: str
    user_id: str
    student_name: str
    phone: str
    campus_id: str
    campus_name: Optional[str] = None
    preferred_zone: Optional[str] = None
    budget_range: str
    gender: str
    room_type: str
    furnishing: str
    stay_preference: str
    move_in_date: Optional[date] = None
    additional_requirements: Optional[str] = None
    status: str
    fee: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HostelRequestZoneOption(BaseModel):
    id: str
    name: str


class HostelRequestFormConfig(BaseModel):
    has_campus: bool
    campus_id: Optional[str] = None
    campus_name: Optional[str] = None
    fee: int = 100
    zones: List[HostelRequestZoneOption] = []