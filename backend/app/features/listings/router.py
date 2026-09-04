from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import NotFoundException
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.security import AuthenticatedUser, get_optional_current_user, require_roles
from app.features.listings.schemas import (
    ListingCreate,
    ListingRead,
    ListingToggleActive,
    ListingToggleCommission,
    ListingToggleFull,
    ListingUpdate,
)
from app.features.listings.service import ListingService
from app.features.profiles.service import ProfileService

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
    sort: Optional[str] = Query(None, description="Sort mode: 'views' ranks by most-visited, otherwise curated sort_position order"),
    pagination: PaginationParams = Depends(),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ListingRead]:
    listings, total, view_counts = await ListingService.get_listings_feed(
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
        sort=sort,
    )
    saved_ids = (
        await ProfileService.get_saved_listing_ids(db, user, [str(item.id) for item in listings])
        if user
        else set()
    )
    items: list[ListingRead] = []
    for item in listings:
        read = ListingRead.model_validate(item)
        read.views = view_counts.get(str(item.id), item.views)
        read.is_saved = str(item.id) in saved_ids
        items.append(read)
    return PaginatedResponse.create(
        items=items,
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
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ListingRead:
    listing = await ListingService.get_listing_by_id_or_slug(db, id_or_slug=id_or_slug)
    if not listing:
        raise NotFoundException(f"Listing '{id_or_slug}' not found")
    read = ListingRead.model_validate(listing)
    if user:
        saved_ids = await ProfileService.get_saved_listing_ids(db, user, [str(listing.id)])
        read.is_saved = str(listing.id) in saved_ids
    return read


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


@router.patch(
    "/{listing_id}/toggle-active",
    response_model=ListingRead,
    status_code=status.HTTP_200_OK,
    summary="Toggle Listing Active Status",
    description="Toggle whether a listing is active/visible (Listing owner or Admin required).",
)
async def toggle_listing_active(
    listing_id: str,
    payload: ListingToggleActive,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ListingRead:
    listing = await ListingService.toggle_listing_active(
        db=db, listing_id=listing_id, user=user, is_active=payload.is_active
    )
    return ListingRead.model_validate(listing)


@router.patch(
    "/{listing_id}/toggle-commission",
    response_model=ListingRead,
    status_code=status.HTTP_200_OK,
    summary="Toggle Commission Payment",
    description="Toggle whether the listing pays commission (Listing owner or Admin required).",
)
async def toggle_listing_commission(
    listing_id: str,
    payload: ListingToggleCommission,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> ListingRead:
    listing = await ListingService.toggle_listing_commission(
        db=db, listing_id=listing_id, user=user, pays_commission=payload.pays_commission
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
