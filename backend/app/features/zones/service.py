from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.campuses.models import Campus
from app.features.zones.models import CampusZone


class ZoneService:
    @staticmethod
    async def get_zones(
        db: AsyncSession,
        campus_id: Optional[str] = None,
        campus_slug: Optional[str] = None,
    ) -> List[CampusZone]:
        stmt = select(CampusZone)

        if campus_id:
            stmt = stmt.where(CampusZone.campus_id == campus_id)
        elif campus_slug:
            stmt = stmt.join(Campus, CampusZone.campus_id == Campus.id).where(Campus.slug == campus_slug)

        stmt = stmt.order_by(CampusZone.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())
