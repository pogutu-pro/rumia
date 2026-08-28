from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import NotFoundException
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.security import AuthenticatedUser, require_roles
from app.features.listings.schemas import (
    ListingCreate,
    ListingRead,
    ListingToggleFull,
    ListingUpdate,
)
from app.features.listings.service import ListingService

router = APIRouter(prefix="/listings", tags=["Listings"])


@router.get(
    "",
    response_model=PaginatedResponse[ListingRead],
    status_code=status.HTTP_200_OK,
    summary="Listings Feed",
    description="Retrieve paginated listing feed with optional filters for campus, zone, area, and price.",
)
async def get_listings(
    campus_slug: Optional[str] = Query(None, description="Filter by campus slug (e.g. 'dekut')"),
    campus_id: Optional[str] = Query(None, description="Filter by campus UUID"),
    zone_slug: Optional[str] = Query(None, description="Filter by zone slug (e.g. 'boma')"),
    zone_id: Optional[str] = Query(None, description="Filter by zone UUID"),
    area: Optional[str] = Query(None, description="Filter by area name"),
    county: Optional[str] = Query(None, description="Filter by county name"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price filter"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ListingRead]:
    listings, total = await ListingService.get_listings_feed(
        db=db,
        pagination=pagination,
        campus_slug=campus_slug,
        campus_id=campus_id,
        zone_slug=zone_slug,
        zone_id=zone_id,
        area=area,
        county=county,
        min_price=min_price,
        max_price=max_price,
    )
    return PaginatedResponse.create(
        items=[ListingRead.model_validate(item) for item in listings],
        total=total,
        page=pagination.page,
        limit=pagination.limit,
    )


@router.get(
    "/{id_or_slug}",
    response_model=ListingRead,
    status_code=status.HTTP_200_OK,
    summary="Get Listing Details",
    description="Retrieve a single listing by its UUID or unique URL slug.",
)
async def get_listing(
    id_or_slug: str,
    db: AsyncSession = Depends(get_db_session),
) -> ListingRead:
    listing = await ListingService.get_listing_by_id_or_slug(db, id_or_slug=id_or_slug)
    if not listing:
        raise NotFoundException(f"Listing '{id_or_slug}' not found")
    return ListingRead.model_validate(listing)


@router.post(
    "",
    response_model=ListingRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Listing",
    description="Create a new hostel listing (Agent or Admin role required).",
)
async def create_listing(
    data: ListingCreate,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ListingRead:
    listing = await ListingService.create_listing(db=db, user=user, data=data)
    return ListingRead.model_validate(listing)


@router.put(
    "/{listing_id}",
    response_model=ListingRead,
    status_code=status.HTTP_200_OK,
    summary="Update Listing",
    description="Update an existing listing (Listing owner or Admin required).",
)
async def update_listing(
    listing_id: str,
    data: ListingUpdate,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ListingRead:
    listing = await ListingService.update_listing(db=db, listing_id=listing_id, user=user, data=data)
    return ListingRead.model_validate(listing)


@router.patch(
    "/{listing_id}/toggle-full",
    response_model=ListingRead,
    status_code=status.HTTP_200_OK,
    summary="Toggle Listing Availability (Full / Available)",
    description="Toggle whether a hostel is fully occupied (Listing owner or Admin required).",
)
async def toggle_listing_full(
    listing_id: str,
    payload: ListingToggleFull,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ListingRead:
    listing = await ListingService.toggle_listing_full(
        db=db, listing_id=listing_id, user=user, is_full=payload.is_full
    )
    return ListingRead.model_validate(listing)


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Listing",
    description="Delete a listing and associated images/room types (Listing owner or Admin required).",
)
async def delete_listing(
    listing_id: str,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await ListingService.delete_listing(db=db, listing_id=listing_id, user=user)
