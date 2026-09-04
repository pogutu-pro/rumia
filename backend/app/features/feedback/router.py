from typing import Optional
from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, decode_jwt_token, require_roles
from app.features.feedback.schemas import FeedbackCreate, FeedbackRead
from app.features.feedback.service import FeedbackService

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post(
    "",
    response_model=FeedbackRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Feedback",
    description="Submit user feedback/suggestion. Optional auth.",
)
@limiter.limit("10/minute")
async def submit_feedback(
    request: Request,
    data: FeedbackCreate,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session),
) -> FeedbackRead:
    user: Optional[AuthenticatedUser] = None
    if authorization and authorization.lower().startswith("bearer "):
        try:
            token = authorization.split()[1]
            token_data = decode_jwt_token(token)
            user = AuthenticatedUser(id=token_data.user_id, email=token_data.email)
        except Exception:
            pass

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
