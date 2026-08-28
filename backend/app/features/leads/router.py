from typing import Optional
from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.security import AuthenticatedUser, decode_jwt_token, get_current_user, require_roles
from app.features.leads.schemas import CommissionRead, LeadRead, LeadTrackRequest
from app.features.leads.service import LeadService

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.post(
    "/track",
    response_model=LeadRead,
    status_code=status.HTTP_200_OK,
    summary="Track Lead Click",
    description="Record a WhatsApp inquiry click. Public (optional auth).",
)
async def track_lead(
    data: LeadTrackRequest,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session),
) -> LeadRead:
    user: Optional[AuthenticatedUser] = None
    if authorization and authorization.lower().startswith("bearer "):
        try:
            token = authorization.split()[1]
            token_data = decode_jwt_token(token)
            user = AuthenticatedUser(id=token_data.user_id, email=token_data.email)
        except Exception:
            pass

    lead = await LeadService.track_lead(db, data, user)
    return LeadRead.model_validate(lead)


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
