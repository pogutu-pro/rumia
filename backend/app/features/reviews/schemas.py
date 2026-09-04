from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ReviewReplyRead(BaseModel):
    id: str
    review_id: str
    user_id: str
    text: str
    author_name: Optional[str] = None
    author_avatar_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewReplyCreate(BaseModel):
    text: str = Field(..., min_length=1)


class ReviewRead(BaseModel):
    id: str
    listing_id: str
    user_id: str
    rating: int
    text: str
    stay_start: Optional[date] = None
    stay_end: Optional[date] = None
    school_verified_at_review_time: bool = False
    status: str
    author_name: Optional[str] = None
    author_avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    rating_cleanliness: Optional[int] = None
    rating_security: Optional[int] = None
    rating_water: Optional[int] = None
    rating_wifi: Optional[int] = None
    rating_facilities: Optional[int] = None
    rating_location: Optional[int] = None
    rating_management: Optional[int] = None
    rating_value: Optional[int] = None

    like_count: int = 0
    reply_count: int = 0
    replies: List[ReviewReplyRead] = []

    model_config = ConfigDict(from_attributes=True)


class ReviewCreate(BaseModel):
    listing_id: str
    rating: int = Field(..., ge=1, le=5)
    text: str = Field(..., min_length=5)
    stay_start: Optional[date] = None
    stay_end: Optional[date] = None
    author_name: Optional[str] = None
    author_avatar_url: Optional[str] = None

    rating_cleanliness: Optional[int] = Field(None, ge=1, le=5)
    rating_security: Optional[int] = Field(None, ge=1, le=5)
    rating_water: Optional[int] = Field(None, ge=1, le=5)
    rating_wifi: Optional[int] = Field(None, ge=1, le=5)
    rating_facilities: Optional[int] = Field(None, ge=1, le=5)
    rating_location: Optional[int] = Field(None, ge=1, le=5)
    rating_management: Optional[int] = Field(None, ge=1, le=5)
    rating_value: Optional[int] = Field(None, ge=1, le=5)


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    text: Optional[str] = Field(None, min_length=5)

    rating_cleanliness: Optional[int] = Field(None, ge=1, le=5)
    rating_security: Optional[int] = Field(None, ge=1, le=5)
    rating_water: Optional[int] = Field(None, ge=1, le=5)
    rating_wifi: Optional[int] = Field(None, ge=1, le=5)
    rating_facilities: Optional[int] = Field(None, ge=1, le=5)
    rating_location: Optional[int] = Field(None, ge=1, le=5)
    rating_management: Optional[int] = Field(None, ge=1, le=5)
    rating_value: Optional[int] = Field(None, ge=1, le=5)


class ReviewModerationAction(BaseModel):
    action: str = Field(..., pattern="^(approve|hide|reject|restore)$")
    note: Optional[str] = None


class ReviewSummaryCategory(BaseModel):
    key: str
    label: str
    average: float
    count: int


class ReviewSummaryDistribution(BaseModel):
    rating: int
    count: int


class ReviewSummary(BaseModel):
    average_rating: float = 0.0
    total_reviews: int = 0
    distribution: List[ReviewSummaryDistribution] = []
    categories: List[ReviewSummaryCategory] = []
