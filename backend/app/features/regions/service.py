from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundException
from app.features.regions.models import Region


class RegionService:
    @staticmethod
    async def get_regions(db: AsyncSession) -> List[Region]:
        result = await db.execute(select(Region).order_by(Region.name.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def get_region_by_slug(db: AsyncSession, slug: str) -> Region:
        result = await db.execute(select(Region).where(Region.slug == slug))
        region = result.scalar_one_or_none()
        if not region:
            raise NotFoundException(f"Region with slug '{slug}' not found")
        return region
