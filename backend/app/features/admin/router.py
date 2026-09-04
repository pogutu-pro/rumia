from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import AuthenticatedUser, require_roles
from app.features.admin.schemas import (
    AgentStatusUpdate,
    CampusCreate,
    CampusStatusUpdate,
    CampusUpdate,
    ListingTransferRequest,
    ManagerAssign,
    ManagerRead,
    PlatformStats,
)
from app.features.admin.service import AdminService
from app.features.agents.schemas import AgentRead
from app.features.campuses.schemas import CampusRead
from app.features.campuses.service import CampusService

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


@router.get(
    "/campuses",
    response_model=List[CampusRead],
    status_code=status.HTTP_200_OK,
    summary="List All Campuses (Admin)",
    description="Fetch all campuses with full management detail. Admin only.",
)
async def list_campuses_admin(
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> List[CampusRead]:
    campuses = await CampusService.get_campuses(db)
    return [CampusRead.model_validate(c) for c in campuses]


@router.post(
    "/campuses",
    response_model=CampusRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Campus",
    description="Create a new university/college campus. Admin only.",
)
async def create_campus(
    data: CampusCreate,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> CampusRead:
    campus = await AdminService.create_campus(db, user, data)
    return CampusRead.model_validate(campus)


@router.patch(
    "/campuses/{campus_id}",
    response_model=CampusRead,
    status_code=status.HTTP_200_OK,
    summary="Update Campus",
    description="Update campus settings or color scheme. Admin only.",
)
async def update_campus(
    campus_id: str,
    data: CampusUpdate,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> CampusRead:
    campus = await AdminService.update_campus(db, user, campus_id, data)
    return CampusRead.model_validate(campus)


@router.patch(
    "/campuses/{campus_id}/status",
    response_model=CampusRead,
    status_code=status.HTTP_200_OK,
    summary="Update Campus Status",
    description="Suspend or activate a campus. Admin only.",
)
async def update_campus_status(
    campus_id: str,
    data: CampusStatusUpdate,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> CampusRead:
    campus = await AdminService.update_campus_status(db, user, campus_id, data)
    return CampusRead.model_validate(campus)


@router.get(
    "/managers",
    response_model=List[ManagerRead],
    status_code=status.HTTP_200_OK,
    summary="List Managers",
    description="Fetch all assigned campus managers. Admin only.",
)
async def list_managers(
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> List[ManagerRead]:
    managers = await AdminService.list_managers(db, user)
    return [ManagerRead.model_validate(m) for m in managers]


@router.post(
    "/managers",
    response_model=ManagerRead,
    status_code=status.HTTP_200_OK,
    summary="Assign Campus Manager",
    description="Grant campus/region manager role to a user profile. Admin only.",
)
async def assign_manager(
    data: ManagerAssign,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ManagerRead:
    prof = await AdminService.assign_manager(db, user, data)
    return ManagerRead.model_validate(prof)


@router.patch(
    "/agents/{agent_id}/status",
    response_model=AgentRead,
    status_code=status.HTTP_200_OK,
    summary="Update Agent Status",
    description="Suspend or activate an agent account. Admin only.",
)
async def update_agent_status(
    agent_id: str,
    data: AgentStatusUpdate,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> AgentRead:
    agent = await AdminService.update_agent_status(db, user, agent_id, data.status)
    return AgentRead.model_validate(agent)


@router.post(
    "/agents/transfer",
    status_code=status.HTTP_200_OK,
    summary="Transfer Listing Ownership",
    description="Reassign hostel listing ownership to a different agent. Admin only.",
)
async def transfer_listing(
    data: ListingTransferRequest,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    history = await AdminService.transfer_listing(db, user, data)
    return {"status": "success", "transfer_id": history.id}


@router.get(
    "/stats",
    response_model=PlatformStats,
    status_code=status.HTTP_200_OK,
    summary="Get Platform Stats",
    description="Fetch total counts of listings, active hostels, agents, and students. Admin only.",
)
async def get_stats(
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PlatformStats:
    return await AdminService.get_platform_stats(db, user)
