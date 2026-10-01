from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.security import AuthenticatedUser, get_current_user, require_roles
from app.features.agents.schemas import (
    AgentApplicationCreate,
    AgentApplicationRead,
    AgentApplicationReview,
    AgentRead,
    AgentUpdate,
)
from app.features.agents.service import AgentService

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get(
    "",
    response_model=List[AgentRead],
    status_code=status.HTTP_200_OK,
    summary="List Agents",
    description="Fetch active agents. Optionally filter by campus_id. Public.",
)
async def list_agents(
    campus_id: Optional[str] = Query(None, description="Filter by campus ID"),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> List[AgentRead]:
    agents = await AgentService.get_agents(db, campus_id=campus_id)
    return [AgentRead.model_validate(a) for a in agents]


@router.get(
    "/applications/my",
    response_model=List[AgentApplicationRead],
    status_code=status.HTTP_200_OK,
    summary="My Agent Applications",
    description="Fetch applications submitted by current user. Authenticated.",
)
async def get_my_applications(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> List[AgentApplicationRead]:
    apps = await AgentService.get_user_applications(db, user.id)
    return [AgentApplicationRead.model_validate(a) for a in apps]


@router.get(
    "/applications",
    response_model=PaginatedResponse[AgentApplicationRead],
    status_code=status.HTTP_200_OK,
    summary="List Agent Applications",
    description="List submitted agent applications. Manager or Admin only.",
)
async def list_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    pagination: PaginationParams = Depends(),
    user: AuthenticatedUser = Depends(require_roles("manager", "admin")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> PaginatedResponse[AgentApplicationRead]:
    items, total = await AgentService.list_applications(db, status_filter=status_filter, pagination=pagination)
    validated = [AgentApplicationRead.model_validate(a) for a in items]
    return PaginatedResponse.create(items=validated, total=total, page=pagination.page, limit=pagination.limit)


@router.patch(
    "/applications/{application_id}/review",
    response_model=AgentApplicationRead,
    status_code=status.HTTP_200_OK,
    summary="Review Agent Application",
    description="Approve or reject an agent application. Manager or Admin only.",
)
async def review_application(
    application_id: str,
    review_data: AgentApplicationReview,
    user: AuthenticatedUser = Depends(require_roles("manager", "admin")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> AgentApplicationRead:
    app_obj = await AgentService.review_application(db, user, application_id, review_data)
    return AgentApplicationRead.model_validate(app_obj)


@router.post(
    "/apply",
    response_model=AgentApplicationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Agent Application",
    description="Apply to become an agent / hostel manager on Rumia. Authenticated users.",
)
async def submit_application(
    data: AgentApplicationCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> AgentApplicationRead:
    app_obj = await AgentService.submit_application(db, user, data)
    return AgentApplicationRead.model_validate(app_obj)


@router.get(
    "/me",
    response_model=AgentRead,
    status_code=status.HTTP_200_OK,
    summary="Get Current Agent Profile",
    description="Fetch current authenticated user's agent profile.",
)
async def get_my_agent_profile(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> AgentRead:
    agent = await AgentService.get_agent_by_user_id(db, user.id)
    return AgentRead.model_validate(agent)


@router.get(
    "/{agent_id}",
    response_model=AgentRead,
    status_code=status.HTTP_200_OK,
    summary="Get Agent Profile",
    description="Fetch single agent profile by ID. Public.",
)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db_session, scope="function")) -> AgentRead:
    agent = await AgentService.get_agent_by_id(db, agent_id)
    return AgentRead.model_validate(agent)


@router.patch(
    "/{agent_id}",
    response_model=AgentRead,
    status_code=status.HTTP_200_OK,
    summary="Update Agent Profile",
    description="Update agent profile details. Agent owner or Admin only.",
)
async def update_agent(
    agent_id: str,
    data: AgentUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> AgentRead:
    agent = await AgentService.update_agent_profile(db, user, agent_id, data)
    return AgentRead.model_validate(agent)
