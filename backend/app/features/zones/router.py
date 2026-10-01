from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.zones.schemas import CampusZoneRead
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
