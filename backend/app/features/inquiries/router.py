import hashlib
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.device import get_device_id
from app.core.ratelimit import _client_ip, limiter
from app.core.security import AuthenticatedUser, get_optional_current_user
from app.core.tasks.worker import send_push_to_user
from app.features.inquiries.schemas import InquiryCreate, InquiryFollowup, InquiryOutcome, InquiryResult
from app.features.inquiries.service import InquiryService

router = APIRouter(prefix="/inquiries", tags=["Inquiries"])


@router.post(
    "",
    response_model=InquiryResult,
    status_code=status.HTTP_201_CREATED,
    summary="Contact A Place",
    description=(
        "Record a contact and return the WhatsApp link (with a pre-written message and reference code) or "
        "tel: link for the person who handles this place. No account needed. Identified by X-Device-Id. "
        "Rate limited. Public."
    ),
)
@limiter.limit("20/minute")
async def create_inquiry(
    request: Request,
    data: InquiryCreate,
    background_tasks: BackgroundTasks,
    device_id: Optional[str] = Depends(get_device_id),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> InquiryResult:
    ip_hash = hashlib.sha256(_client_ip(request).encode()).hexdigest()
    result, notify_user_id, title = await InquiryService.create(db, data, device_id, user.id if user else None, ip_hash)
    if notify_user_id:
        background_tasks.add_task(
            send_push_to_user,
            notify_user_id,
            "New inquiry",
            f'Someone is interested in "{title}". Reference {result.ref_code}.',
            {"url": "/dashboard", "type": "lead"},
        )
    return result


@router.post(
    "/{ref_code}/followup",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Did They Reply?",
    description="The seeker says whether the place replied. Only the device that made the contact may answer.",
)
@limiter.limit("30/minute")
async def inquiry_followup(
    request: Request,
    ref_code: str,
    data: InquiryFollowup,
    device_id: Optional[str] = Depends(get_device_id),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> None:
    await InquiryService.followup(db, ref_code, device_id, data.replied)


@router.post(
    "/{ref_code}/outcome",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Report The Outcome",
    description="The seeker reports whether they moved in. Only the device that made the contact may answer.",
)
@limiter.limit("30/minute")
async def inquiry_outcome(
    request: Request,
    ref_code: str,
    data: InquiryOutcome,
    device_id: Optional[str] = Depends(get_device_id),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> None:
    await InquiryService.outcome(db, ref_code, device_id, data.outcome)
