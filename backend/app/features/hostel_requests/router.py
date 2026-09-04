from typing import List

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_current_user
from app.features.hostel_requests.schemas import (
    HostelRequestCreate,
    HostelRequestFormConfig,
    HostelRequestRead,
    HostelRequestUpdate,
)
from app.features.hostel_requests.service import HostelRequestService

router = APIRouter(prefix="/hostel-requests", tags=["Hostel Requests"])


@router.post(
    "",
    response_model=HostelRequestRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Hostel Request",
    description="Submit a 'Find Me a Hostel' request. Authenticated.",
)
@limiter.limit("10/minute")
async def create_hostel_request(
    request: Request,
    data: HostelRequestCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> HostelRequestRead:
    created = await HostelRequestService.create_request(db, user, data)
    return HostelRequestRead.model_validate(created)


@router.get(
    "/me",
    response_model=List[HostelRequestRead],
    status_code=status.HTTP_200_OK,
    summary="List My Hostel Requests",
    description="Fetch the current student's hostel requests, newest first.",
)
async def list_my_hostel_requests(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> List[HostelRequestRead]:
    items = await HostelRequestService.list_my_requests(db, user)
    return [HostelRequestRead.model_validate(r) for r in items]


@router.get(
    "/form-config",
    response_model=HostelRequestFormConfig,
    status_code=status.HTTP_200_OK,
    summary="Hostel Request Form Config",
    description="Campus fee + preferred-area zones for the current student's profile campus.",
)
async def hostel_request_form_config(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> HostelRequestFormConfig:
    return await HostelRequestService.get_form_config(db, user)


@router.patch(
    "/{request_id}",
    response_model=HostelRequestRead,
    status_code=status.HTTP_200_OK,
    summary="Update Hostel Request",
    description="Update own waiting/contacted request. Authenticated owner.",
)
async def update_hostel_request(
    request_id: str,
    data: HostelRequestUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> HostelRequestRead:
    updated = await HostelRequestService.update_request(db, user, request_id, data)
    return HostelRequestRead.model_validate(updated)


@router.post(
    "/{request_id}/cancel",
    response_model=HostelRequestRead,
    status_code=status.HTTP_200_OK,
    summary="Cancel Hostel Request",
    description="Cancel own waiting/contacted request. Authenticated owner.",
)
async def cancel_hostel_request(
    request_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> HostelRequestRead:
    cancelled = await HostelRequestService.cancel_request(db, user, request_id)
    return HostelRequestRead.model_validate(cancelled)


@router.delete(
    "/{request_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Hostel Request",
    description="Permanently delete own cancelled request. Authenticated owner.",
)
async def delete_hostel_request(
    request_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await HostelRequestService.delete_request(db, user, request_id)
    return {"message": "Request deleted"}