from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import AuthenticatedUser, get_current_user
from app.features.official_hostels.schemas import (
    OfficialHostelRead,
    OfficialHostelsOverview,
    OfficialHostelWrite,
)
from app.features.official_hostels.service import OfficialHostelService

router = APIRouter(prefix="/official-hostels", tags=["Official Hostels"])


@router.get(
    "",
    response_model=List[OfficialHostelRead],
    status_code=status.HTTP_200_OK,
    summary="Official Hostel Records",
    description="The official DeKUT housing records. Agents, managers and admins.",
)
async def list_official_hostels(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> List[OfficialHostelRead]:
    await OfficialHostelService.assert_can_view(db, user)
    return [OfficialHostelRead.model_validate(o) for o in await OfficialHostelService.list_official(db)]


@router.get(
    "/overview",
    response_model=OfficialHostelsOverview,
    status_code=status.HTTP_200_OK,
    summary="Official Records vs Platform Listings",
    description="Official records alongside every platform listing's contact/payment details, for cross-checking. Agents, managers and admins.",
)
async def official_hostels_overview(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> OfficialHostelsOverview:
    await OfficialHostelService.assert_can_view(db, user)
    return await OfficialHostelService.overview(db)


@router.post("", response_model=OfficialHostelRead, status_code=status.HTTP_201_CREATED, summary="Create Official Record (Admin)")
async def create_official_hostel(
    data: OfficialHostelWrite, user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> OfficialHostelRead:
    return OfficialHostelRead.model_validate(await OfficialHostelService.create(db, user, data))


@router.post("/seed", summary="Seed Official Records (Admin)",
             description="Loads the bundled records; names already present are skipped, so it is safe to re-run.")
async def seed_official_hostels(
    user: AuthenticatedUser = Depends(get_current_user), db: AsyncSession = Depends(get_db_session, scope="function"),
) -> dict:
    return {"seeded": await OfficialHostelService.seed(db, user)}


@router.patch("/{record_id}", response_model=OfficialHostelRead, summary="Update Official Record (Admin)")
async def update_official_hostel(
    record_id: str, data: OfficialHostelWrite, user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> OfficialHostelRead:
    return OfficialHostelRead.model_validate(await OfficialHostelService.update(db, user, record_id, data))


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Official Record (Admin)")
async def delete_official_hostel(
    record_id: str, user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> None:
    await OfficialHostelService.delete(db, user, record_id)
