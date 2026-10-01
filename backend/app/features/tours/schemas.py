from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TourBookingCreate(BaseModel):
    student_name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., min_length=7, max_length=40)
    listing_id: Optional[str] = None
    zone: str = Field(..., min_length=1, max_length=120)
    # Scopes the zone price lookup to one campus; required when a zone name exists on several.
    campus_id: Optional[str] = None
    tour_type: str = Field(..., pattern="^(specific_hostel|full_search)$")
    preferred_date: date
    preferred_time: str = Field(..., pattern="^(morning|afternoon|evening)$")
    agent_id: Optional[str] = None
    # Analytics only.
    from_listing: bool = False
    # NOTE: there is deliberately no `amount`: the price is always the zone's configured price,
    # computed server-side. Extra fields (e.g. a stale client-sent amount) are ignored.


class TourBookingStudentUpdate(BaseModel):
    """Fields a student may change on their own pending booking."""

    preferred_date: Optional[date] = None
    preferred_time: Optional[str] = Field(None, pattern="^(morning|afternoon|evening)$")
    phone: Optional[str] = Field(None, min_length=7, max_length=40)


class TourBookingUpdateStatus(BaseModel):
    status: str = Field(..., pattern="^(pending_payment|confirmed|paid|contacted|completed|no_show|cancelled)$")


class TourBookingRead(BaseModel):
    id: str
    student_name: str
    phone: str
    listing_id: Optional[str] = None
    zone: str
    tour_type: str
    amount: float
    preferred_date: date
    preferred_time: str
    status: str
    linked_user_id: Optional[str] = None
    agent_id: Optional[str] = None
    contacted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TourListingImage(BaseModel):
    r2_url: str
    display_order: int = 0

    model_config = ConfigDict(from_attributes=True)


class TourListingBrief(BaseModel):
    id: str
    title: str
    area: Optional[str] = None
    county: Optional[str] = None
    slug: Optional[str] = None
    images: List[TourListingImage] = []

    model_config = ConfigDict(from_attributes=True)


class MyTourBookingRead(TourBookingRead):
    """A student's own booking with a brief of the toured listing embedded."""

    listing: Optional[TourListingBrief] = None
