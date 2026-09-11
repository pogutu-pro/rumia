from typing import List, Optional, Tuple
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PaginationParams
from app.features.campuses.models import Campus
from app.features.listings.models import Listing
from app.features.zones.models import CampusZone


_SEARCH_CACHE: dict = {}
_SEARCH_CACHE_TTL = 30

class SearchService:
    @staticmethod
    async def search_listings(
        db: AsyncSession,
        q: Optional[str] = None,
        campus_slug: Optional[str] = None,
        zone_slug: Optional[str] = None,
        area: Optional[str] = None,
        property_type: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[Listing], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=20)
        import time as _time
        cache_key = (q or "", campus_slug or "", zone_slug or "", area or "", property_type or "", str(min_price), str(max_price), pagination.page, pagination.limit)
        now = _time.time()
        if cache_key in _SEARCH_CACHE:
            ts, cached = _SEARCH_CACHE[cache_key]
            if now - ts < _SEARCH_CACHE_TTL:
                return cached
        stmt = select(Listing).where(Listing.is_active.is_(True))

        if campus_slug:
            stmt = stmt.join(Campus, Listing.campus_id == Campus.id).where(Campus.slug == campus_slug)

        if zone_slug:
            stmt = stmt.join(CampusZone, Listing.zone_id == CampusZone.id).where(CampusZone.slug == zone_slug)

        if area:
            stmt = stmt.where(Listing.area.ilike(f"%{area}%"))

        if property_type:
            stmt = stmt.where(Listing.property_type == property_type)

        if min_price is not None:
            stmt = stmt.where(Listing.price >= min_price)

        if max_price is not None:
            stmt = stmt.where(Listing.price <= max_price)

        relevance_order = None
        if q and q.strip():
            term = f"%{q.strip()}%"
            raw = q.strip()
            lower_raw = raw.lower()
            stmt = stmt.where(
                or_(
                    Listing.title.ilike(term),
                    Listing.description.ilike(term),
                    Listing.location.ilike(term),
                    Listing.area.ilike(term),
                )
            )
            relevance_order = case(
                (func.lower(Listing.title) == lower_raw, 0),
                (func.lower(Listing.title).like(lower_raw + "%"), 1),
                (func.lower(Listing.title).like("%" + lower_raw + "%"), 2),
                (func.lower(Listing.area).like("%" + lower_raw + "%"), 3),
                (func.lower(Listing.location).like("%" + lower_raw + "%"), 4),
                else_=5,
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        # Apply ordering and pagination — relevance first, then editorial pinning
        if relevance_order is not None:
            stmt = stmt.order_by(relevance_order, Listing.sort_position.asc().nulls_last(), Listing.created_at.desc())
        else:
            stmt = stmt.order_by(Listing.sort_position.asc().nulls_last(), Listing.created_at.desc())
        stmt = stmt.offset(pagination.offset).limit(pagination.limit)

        result = await db.execute(stmt)
        items = list(result.scalars().all())
        _SEARCH_CACHE[cache_key] = (now, (items, total))
        if len(_SEARCH_CACHE) > 200:
            oldest = min(_SEARCH_CACHE, key=lambda k: _SEARCH_CACHE[k][0])
            del _SEARCH_CACHE[oldest]
        return items, total
