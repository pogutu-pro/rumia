from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_current_user, require_roles
from app.core.tasks.worker import send_push_to_user
from app.features.hostel_requests.schemas import (
    HostelRequestCreate,
    HostelRequestFormConfig,
    HostelRequestRead,
    HostelRequestStatusUpdate,
    HostelRequestUpdate,
    ManagedHostelRequestRead,
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
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> HostelRequestRead:
    created, pushes = await HostelRequestService.create_request(db, user, data)
    for push in pushes:  # in-app notification + push to the campus's managers
        background_tasks.add_task(
            send_push_to_user, push.user_id, push.title, push.body, {"url": push.url, "type": "hostel_request"}
        )
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> dict:
    await HostelRequestService.delete_request(db, user, request_id)
    return {"message": "Request deleted"}

@router.get(
    "/manage",
    response_model=List[ManagedHostelRequestRead],
    status_code=status.HTTP_200_OK,
    summary="List Requests I Manage",
    description="Requests for the campuses this manager oversees (all for admins), newest first.",
)
async def list_managed_requests(
    user: AuthenticatedUser = Depends(require_roles("manager")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> List[ManagedHostelRequestRead]:
    return await HostelRequestService.list_managed(db, user)


@router.get(
    "/manage/{request_id}",
    response_model=ManagedHostelRequestRead,
    status_code=status.HTTP_200_OK,
    summary="Get Managed Request",
    description="One request, if it belongs to a campus this manager oversees (otherwise 404).",
)
async def get_managed_request(
    request_id: str,
    user: AuthenticatedUser = Depends(require_roles("manager")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> ManagedHostelRequestRead:
    return await HostelRequestService.get_managed(db, user, request_id)


@router.patch(
    "/{request_id}/status",
    response_model=HostelRequestRead,
    status_code=status.HTTP_200_OK,
    summary="Update Request Status",
    description="Campus manager/admin moves a request along its workflow; the student is notified.",
)
async def update_request_status(
    request_id: str,
    data: HostelRequestStatusUpdate,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(require_roles("manager")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> HostelRequestRead:
    updated, push = await HostelRequestService.update_status(db, user, request_id, data.status)
    if push:
        background_tasks.add_task(
            send_push_to_user, push.user_id, push.title, push.body, {"url": push.url, "type": "hostel_request"}
        )
    return HostelRequestRead.model_validate(updated)
