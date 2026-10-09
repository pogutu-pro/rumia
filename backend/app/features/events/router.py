from typing import Optional

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.device import get_device_id
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_optional_current_user
from app.features.events.schemas import EventBatch, EventBatchResult
from app.features.events.service import EventService

router = APIRouter(prefix="/events", tags=["Events"])


@router.post(
    "",
    response_model=EventBatchResult,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest Behaviour Events",
    description=(
        "Batched first-party analytics events (max 50). Pseudonymous: identified by the X-Device-Id header "
        "and, when signed in, the user. Only whitelisted event names are accepted. Rate limited. Public."
    ),
)
@limiter.limit("60/minute")
async def ingest_events(
    request: Request,
    batch: EventBatch,
    device_id: Optional[str] = Depends(get_device_id),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> EventBatchResult:
    accepted = await EventService.ingest(db, batch, device_id, user.id if user else None)
    return EventBatchResult(accepted=accepted)
