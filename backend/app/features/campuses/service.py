from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.campuses.models import Campus


class CampusService:
    @staticmethod
    async def get_campuses(db: AsyncSession, status: Optional[str] = "active") -> List[Campus]:
        stmt = select(Campus)
        if status:
            stmt = stmt.where(Campus.status == status)
        stmt = stmt.order_by(Campus.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_campus_by_slug(db: AsyncSession, slug: str) -> Optional[Campus]:
        stmt = select(Campus).where(Campus.slug == slug)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
