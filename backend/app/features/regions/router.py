from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.regions.schemas import RegionRead
from app.features.regions.service import RegionService

router = APIRouter(prefix="/regions", tags=["Regions"])


@router.get(
    "",
    response_model=List[RegionRead],
    status_code=status.HTTP_200_OK,
    summary="List Regions",
    description="Fetch all administrative regions. Public.",
)
async def list_regions(db: AsyncSession = Depends(get_db_session)) -> List[RegionRead]:
    regions = await RegionService.get_regions(db)
    return [RegionRead.model_validate(r) for r in regions]


@router.get(
    "/{slug}",
    response_model=RegionRead,
    status_code=status.HTTP_200_OK,
    summary="Get Region Details",
    description="Fetch details of a single region by slug. Public.",
)
async def get_region(slug: str, db: AsyncSession = Depends(get_db_session)) -> RegionRead:
    region = await RegionService.get_region_by_slug(db, slug)
    return RegionRead.model_validate(region)
