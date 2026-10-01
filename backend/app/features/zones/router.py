from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.tours.service import TourService
from app.core.security import AuthenticatedUser, require_roles
from app.features.zones.schemas import CampusZoneRead, TourPriceRead, ZoneCreate, ZoneWrite
from app.features.zones.service import ZoneService

router = APIRouter(prefix="/zones", tags=["Campus Zones"])


@router.get(
    "",
    response_model=List[CampusZoneRead],
    status_code=status.HTTP_200_OK,
    summary="List Campus Zones",
    description="Retrieve zones, optionally filtered by campus_id or campus_slug (e.g. 'dekut').",
)
async def list_zones(
    campus_id: Optional[str] = Query(None, description="Filter by campus UUID"),
    campus_slug: Optional[str] = Query(None, description="Filter by campus slug (e.g. 'dekut')"),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> List[CampusZoneRead]:
    return await ZoneService.get_zones(db, campus_id=campus_id, campus_slug=campus_slug)


@router.get(
    "/tour-price",
    response_model=TourPriceRead,
    status_code=status.HTTP_200_OK,
    summary="Zone Tour Price",
    description=(
        "The configured tour price for a zone on an active campus, or null when none is set or the "
        "zone name is ambiguous across campuses (pass campus_id to disambiguate). Public."
    ),
)
async def get_tour_price(
    zone: str = Query(..., min_length=1, max_length=120),
    campus_id: Optional[str] = Query(None, description="Campus UUID"),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> TourPriceRead:
    return TourPriceRead(price=await TourService.get_zone_price(db, zone, campus_id))


Manager = Depends(require_roles("manager"))


@router.post("", response_model=CampusZoneRead, status_code=status.HTTP_201_CREATED, summary="Create Zone",
             description="Managers (for campuses they manage) and admins.")
async def create_zone(
    data: ZoneCreate, user: AuthenticatedUser = Manager, db: AsyncSession = Depends(get_db_session, scope="function"),
) -> CampusZoneRead:
    return CampusZoneRead.model_validate(await ZoneService.create_zone(db, user, data))


@router.patch("/{zone_id}", response_model=CampusZoneRead, summary="Update Zone",
              description="Renames re-generate the slug. Managers for their campuses, and admins.")
async def update_zone(
    zone_id: str, data: ZoneWrite, user: AuthenticatedUser = Manager,
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> CampusZoneRead:
    return CampusZoneRead.model_validate(await ZoneService.update_zone(db, user, zone_id, data))


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Zone",
               description="Refused while listings on the campus still use the area.")
async def delete_zone(
    zone_id: str, user: AuthenticatedUser = Manager, db: AsyncSession = Depends(get_db_session, scope="function"),
) -> None:
    await ZoneService.delete_zone(db, user, zone_id)
