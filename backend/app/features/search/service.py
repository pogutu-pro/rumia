from typing import List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PaginationParams
from app.features.campuses.models import Campus
from app.features.listings.models import Listing
from app.features.zones.models import CampusZone


class SearchService:
    @staticmethod
    async def search_listings(
        db: AsyncSession,
        q: Optional[str] = None,
        campus_slug: Optional[str] = None,
        zone_slug: Optional[str] = None,
        area: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[Listing], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=20)
        stmt = select(Listing).where(Listing.is_active.is_(True))

        if campus_slug:
            stmt = stmt.join(Campus, Listing.campus_id == Campus.id).where(Campus.slug == campus_slug)

        if zone_slug:
            stmt = stmt.join(CampusZone, Listing.zone_id == CampusZone.id).where(CampusZone.slug == zone_slug)

        if area:
            stmt = stmt.where(Listing.area.ilike(f"%{area}%"))

        if min_price is not None:
            stmt = stmt.where(Listing.price >= min_price)

        if max_price is not None:
            stmt = stmt.where(Listing.price <= max_price)

        if q and q.strip():
            term = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Listing.title.ilike(term),
                    Listing.description.ilike(term),
                    Listing.location.ilike(term),
                    Listing.area.ilike(term),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        # Apply ordering and pagination
        stmt = stmt.order_by(Listing.sort_position.asc().nulls_last(), Listing.created_at.desc())
        stmt = stmt.offset(pagination.offset).limit(pagination.limit)

        result = await db.execute(stmt)
        items = list(result.scalars().all())
        return items, total
