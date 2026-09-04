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
    today_count: int
    week_count: int
    month_count: int
    all_time_count: int


class TrackViewRequest(BaseModel):
    listing_id: str
    user_id: Optional[str] = None
    ip_hash: Optional[str] = None


class TrackViewResponse(BaseModel):
    inserted: bool
    dedupe: Optional[str] = None
    reason: Optional[str] = None
