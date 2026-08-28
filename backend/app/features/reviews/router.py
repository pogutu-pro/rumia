from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.security import AuthenticatedUser, get_current_user, require_roles
from app.features.reviews.schemas import (
    ReviewCreate,
    ReviewModerationAction,
    ReviewRead,
    ReviewReplyCreate,
    ReviewReplyRead,
    ReviewSummary,
    ReviewUpdate,
)
from app.features.reviews.service import ReviewService

router = APIRouter(prefix="/reviews", tags=["Reviews"])


def _to_review_read(r) -> ReviewRead:
    replies_read = [ReviewReplyRead.model_validate(reply) for reply in (r.replies or [])]
    data = ReviewRead.model_validate(r)
    data.like_count = len(r.likes or [])
    data.reply_count = len(r.replies or [])
    data.replies = replies_read
    return data


@router.get(
    "",
    response_model=PaginatedResponse[ReviewRead],
    status_code=status.HTTP_200_OK,
    summary="List Reviews",
    description="Fetch published reviews for a listing. Public.",
)
async def list_reviews(
    listing_id: Optional[str] = Query(None, description="Filter by listing ID"),
    status_filter: str = Query("published", alias="status"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ReviewRead]:
    items, total = await ReviewService.list_reviews(db, listing_id=listing_id, status_filter=status_filter, pagination=pagination)
    validated = [_to_review_read(r) for r in items]
    return PaginatedResponse.create(items=validated, total=total, page=pagination.page, limit=pagination.limit)


@router.get(
    "/summary/{listing_id}",
    response_model=ReviewSummary,
    status_code=status.HTTP_200_OK,
    summary="Get Listing Review Summary",
    description="Fetch aggregate rating, distribution, and category breakdown for a listing. Public.",
)
async def get_review_summary(listing_id: str, db: AsyncSession = Depends(get_db_session)) -> ReviewSummary:
    summary_dict = await ReviewService.get_summary(db, listing_id)
    return ReviewSummary.model_validate(summary_dict)


@router.get(
    "/{review_id}",
    response_model=ReviewRead,
    status_code=status.HTTP_200_OK,
    summary="Get Review Details",
    description="Fetch single review by ID. Public.",
)
async def get_review(review_id: str, db: AsyncSession = Depends(get_db_session)) -> ReviewRead:
    r = await ReviewService.get_review_by_id(db, review_id)
    return _to_review_read(r)


@router.post(
    "",
    response_model=ReviewRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Review",
    description="Submit a new review for a hostel. Authenticated users.",
)
async def create_review(
    data: ReviewCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ReviewRead:
    r = await ReviewService.create_review(db, user, data)
    return _to_review_read(r)


@router.put(
    "/{review_id}",
    response_model=ReviewRead,
    status_code=status.HTTP_200_OK,
    summary="Update Own Review",
    description="Update review rating/text/categories. Review owner or admin.",
)
async def update_review(
    review_id: str,
    data: ReviewUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ReviewRead:
    r = await ReviewService.update_review(db, user, review_id, data)
    return _to_review_read(r)


@router.delete(
    "/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Review",
    description="Delete a review. Review owner or admin.",
)
async def delete_review(
    review_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await ReviewService.delete_review(db, user, review_id)


@router.post(
    "/{review_id}/like",
    status_code=status.HTTP_200_OK,
    summary="Toggle Like on Review",
    description="Like or unlike a review. Authenticated users.",
)
async def toggle_like(
    review_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    is_liked = await ReviewService.toggle_like(db, user, review_id)
    return {"liked": is_liked}


@router.post(
    "/{review_id}/reply",
    response_model=ReviewReplyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add Reply to Review",
    description="Post a reply on a review. Authenticated users.",
)
async def add_reply(
    review_id: str,
    data: ReviewReplyCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ReviewReplyRead:
    reply = await ReviewService.add_reply(db, user, review_id, data)
    return ReviewReplyRead.model_validate(reply)


@router.patch(
    "/{review_id}/moderate",
    response_model=ReviewRead,
    status_code=status.HTTP_200_OK,
    summary="Moderate Review",
    description="Approve, hide, reject, or restore a review. Admin only.",
)
async def moderate_review(
    review_id: str,
    action: ReviewModerationAction,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ReviewRead:
    r = await ReviewService.moderate_review(db, user, review_id, action)
    return _to_review_read(r)
