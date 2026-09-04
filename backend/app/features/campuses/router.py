from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import NotFoundException
from app.features.campuses.schemas import CampusRead
from app.features.campuses.service import CampusService

router = APIRouter(prefix="/campuses", tags=["Campuses"])


@router.get(
    "",
    response_model=List[CampusRead],
    status_code=status.HTTP_200_OK,
    summary="List Campuses",
    description="Retrieve all registered campuses (filtered by active status by default).",
)
async def list_campuses(
    status_filter: Optional[str] = Query("active", alias="status"),
    db: AsyncSession = Depends(get_db_session),
) -> List[CampusRead]:
    return await CampusService.get_campuses(db, status=status_filter)


@router.get(
    "/{slug}",
    response_model=CampusRead,
    status_code=status.HTTP_200_OK,
    summary="Get Campus Details",
    description="Retrieve a single campus by its unique slug identifier (e.g. 'dekut').",
)
async def get_campus(
    slug: str,
    db: AsyncSession = Depends(get_db_session),
) -> CampusRead:
    campus = await CampusService.get_campus_by_slug(db, slug=slug)
    if not campus:
        raise NotFoundException(f"Campus with slug '{slug}' not found")
    return campus
