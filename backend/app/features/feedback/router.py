from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_current_user, require_roles
from app.features.feedback.schemas import FeedbackCreate, FeedbackRead
from app.features.feedback.service import FeedbackService

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post(
    "",
    response_model=FeedbackRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Feedback",
    description="Submit feedback/suggestion/problem report. Authenticated.",
)
@limiter.limit("10/minute")
async def submit_feedback(
    request: Request,
    data: FeedbackCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> FeedbackRead:
    fb = await FeedbackService.create_feedback(db, data, user)
    return FeedbackRead.model_validate(fb)


@router.get(
    "",
    response_model=PaginatedResponse[FeedbackRead],
    status_code=status.HTTP_200_OK,
    summary="List Feedback",
    description="List all submitted feedback. Admin only.",
)
async def list_feedback(
    pagination: PaginationParams = Depends(),
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[FeedbackRead]:
    items, total = await FeedbackService.list_feedback(db, pagination)
    validated = [FeedbackRead.model_validate(f) for f in items]
    return PaginatedResponse.create(items=validated, total=total, page=pagination.page, limit=pagination.limit)
