from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.features.listings.schemas import ListingRead
from app.features.search.service import SearchService

router = APIRouter(prefix="/search", tags=["Search"])


@router.get(
    "",
    response_model=PaginatedResponse[ListingRead],
    status_code=status.HTTP_200_OK,
    summary="Search Listings",
    description="Search and filter active listings by text query, campus, zone, area, and price range.",
)
async def search_listings(
    q: Optional[str] = Query(None, description="Search query matching title, description, or location"),
    campus_slug: Optional[str] = Query(None, description="Filter by campus slug"),
    zone_slug: Optional[str] = Query(None, description="Filter by zone slug"),
    area: Optional[str] = Query(None, description="Filter by specific area"),
    min_price: Optional[float] = Query(None, description="Minimum monthly price"),
    max_price: Optional[float] = Query(None, description="Maximum monthly price"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ListingRead]:
    items, total = await SearchService.search_listings(
        db=db,
        q=q,
        campus_slug=campus_slug,
        zone_slug=zone_slug,
        area=area,
        min_price=min_price,
        max_price=max_price,
        pagination=pagination,
    )
    validated_items = [ListingRead.model_validate(item) for item in items]
    return PaginatedResponse.create(
        items=validated_items,
        total=total,
        page=pagination.page,
        limit=pagination.limit,
    )
