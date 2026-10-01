from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ViewCountRead(BaseModel):
    listing_id: str
    today_count: int
    week_count: int
    month_count: int
    all_time_count: int


class PlatformViewSummary(BaseModel):
    today_count: int
    week_count: int
    month_count: int
    all_time_count: int


class AgentListingViewEntry(BaseModel):
    listing_id: str
    listing_title: Optional[str] = None
    listing_slug: Optional[str] = None
    county: Optional[str] = None
    area: Optional[str] = None
    today_count: int
    week_count: int
    month_count: int
    all_time_count: int


class TrackViewRequest(BaseModel):
    # Identity (JWT) and visitor fingerprint (client IP + user-agent) are derived server-side;
    # clients can no longer supply a user_id or ip_hash.
    listing_id: str


class TrackViewResponse(BaseModel):
    inserted: bool
    dedupe: Optional[str] = None
    reason: Optional[str] = None
