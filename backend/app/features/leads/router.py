import hashlib

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.ratelimit import _client_ip, limiter
from app.core.security import AuthenticatedUser, get_current_user, require_roles
from app.core.tasks.worker import send_push_to_user
from app.features.leads.schemas import CommissionRead, LeadRead, LeadTrackRequest, LeadTrackResult
from app.features.leads.service import LeadService

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.post(
    "/track",
    response_model=LeadTrackResult,
    status_code=status.HTTP_200_OK,
    summary="Track Lead Click",
    description=(
        "Record a student's click to contact a listing's agent or owner and return the contact "
        "details needed to open the chat. Public. Deduplicated per visitor per listing per 24h; "
        "409 codes: REQUIRES_AGENT (hostel full), FEE_REQUIRED (fee disclosure not accepted)."
    ),
)
@limiter.limit("10/minute")
async def track_lead(
    request: Request,
    data: LeadTrackRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
) -> LeadTrackResult:
    ip_hash = hashlib.sha256(_client_ip(request).encode()).hexdigest()
    tracked = await LeadService.track_lead(db, data, ip_hash)
    if tracked.notify_user_id:
        background_tasks.add_task(
            send_push_to_user,
            tracked.notify_user_id,
            "New student inquiry",
            f'Someone is interested in "{tracked.listing_title}". Check your dashboard.',
            {"url": "/dashboard", "type": "lead"},
        )
    return tracked.result


@router.get(
    "",
    response_model=PaginatedResponse[LeadRead],
    status_code=status.HTTP_200_OK,
    summary="List Leads",
    description="Fetch recorded leads. Agent sees own, Admin sees all.",
)
async def list_leads(
    pagination: PaginationParams = Depends(),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[LeadRead]:
    items, total = await LeadService.list_leads(db, user, pagination)
    validated = [LeadRead.model_validate(l) for l in items]
    return PaginatedResponse.create(items=validated, total=total, page=pagination.page, limit=pagination.limit)


@router.get(
    "/commissions",
    response_model=PaginatedResponse[CommissionRead],
    status_code=status.HTTP_200_OK,
    summary="List Commissions",
    description="Fetch commission records. Agent sees own, Admin sees all.",
)
async def list_commissions(
    pagination: PaginationParams = Depends(),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[CommissionRead]:
    items, total = await LeadService.list_commissions(db, user, pagination)
    validated = [CommissionRead.model_validate(c) for c in items]
    return PaginatedResponse.create(items=validated, total=total, page=pagination.page, limit=pagination.limit)


@router.patch(
    "/commissions/{commission_id}/pay",
    response_model=CommissionRead,
    status_code=status.HTTP_200_OK,
    summary="Pay Commission",
    description="Mark a commission as paid. Admin only.",
)
async def pay_commission(
    commission_id: str,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> CommissionRead:
    comm = await LeadService.pay_commission(db, user, commission_id)
    return CommissionRead.model_validate(comm)
