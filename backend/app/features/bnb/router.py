from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import NotFoundException
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.security import AuthenticatedUser, get_optional_current_user, require_roles
from app.features.bnb.schemas import BnbListingCreate, BnbListingRead, BnbListingUpdate
from app.features.bnb.service import BnbService
from app.features.listings.schemas import ListingRead
from app.features.listings.service import ListingService

router = APIRouter(prefix="/bnb", tags=["RumiaBnB"])


def _to_read(listing, bnb) -> BnbListingRead:
    from app.features.listings.schemas import ListingRead
    listing_read = ListingRead.model_validate(listing)
    return BnbListingRead(
        id=listing_read.id,
        title=listing_read.title,
        slug=listing_read.slug,
        description=listing_read.description,
        property_type=listing_read.property_type,
        price=listing_read.price,
        location=listing_read.location,
        county=listing_read.county,
        area=listing_read.area,
        specific_location=listing_read.specific_location,
        latitude=listing_read.latitude,
        longitude=listing_read.longitude,
        amenities=listing_read.amenities,
        is_active=listing_read.is_active,
        verified=listing.verified,
        rating=listing_read.rating,
        views=listing_read.views,
        agent_id=listing_read.agent.id if listing_read.agent else listing.agent_id,
        campus_id=listing_read.campus_id,
        created_at=listing_read.created_at,
        updated_at=listing_read.updated_at,
        images=[
            {
                "id": img.id,
                "r2_url": img.r2_url,
                "image_upload_id": img.image_upload_id,
                "display_order": img.display_order,
                "category": img.category,
                "blur_data_url": img.blur_data_url,
                "width": img.width,
                "height": img.height,
                "format": img.format,
            }
            for img in (listing_read.images or [])
        ],
        agent={
            "id": listing_read.agent.id,
            "name": listing_read.agent.name,
            "phone": listing_read.agent.phone,
            "whatsapp": listing_read.agent.whatsapp,
            "slug": listing_read.agent.slug,
        } if listing_read.agent else None,
        bnb=bnb,
    )


@router.get(
    "/public",
    response_model=PaginatedResponse[BnbListingRead],
    status_code=status.HTTP_200_OK,
    summary="Public BnB Listings Feed",
)
async def get_public_bnb_listings(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[BnbListingRead]:
    """Public feed of all active BnB (short_stay) listings with bnb_details."""
    from sqlalchemy import select, func
    from app.features.listings.models import Listing
    from app.features.bnb.models import BnbDetails

    stmt = (
        select(Listing)
        .where(Listing.is_active == True)
        .where(Listing.property_type == "short_stay")
        .order_by(
            Listing.sort_position.asc().nulls_last(),
            Listing.created_at.desc(),
        )
    )

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar_one()

    stmt = stmt.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(stmt)
    listings = list(result.scalars().all())

    # Batch-load bnb_details for all listing ids
    listing_ids = [l.id for l in listings]
    bnb_map: dict = {}
    if listing_ids:
        bnb_result = await db.execute(
            select(BnbDetails).where(BnbDetails.listing_id.in_(listing_ids))
        )
        for bnb in bnb_result.scalars().all():
            bnb_map[bnb.listing_id] = bnb

    items = [_to_read(l, bnb_map.get(l.id)) for l in listings]
    return PaginatedResponse.create(
        items=items, total=total, page=pagination.page, limit=pagination.limit
    )

@router.post(
    "",
    response_model=BnbListingRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create BnB Listing",
)
async def create_bnb_listing(
    data: BnbListingCreate,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> BnbListingRead:
    listing, bnb = await BnbService.create_bnb_listing(db=db, user=user, data=data)
    return _to_read(listing, bnb)


@router.put(
    "/{listing_id}",
    response_model=BnbListingRead,
    status_code=status.HTTP_200_OK,
    summary="Update BnB Listing",
)
async def update_bnb_listing(
    listing_id: str,
    data: BnbListingUpdate,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> BnbListingRead:
    listing, bnb = await BnbService.update_bnb_listing(
        db=db, listing_id=listing_id, user=user, data=data
    )
    return _to_read(listing, bnb)


@router.get(
    "/my",
    response_model=PaginatedResponse[BnbListingRead],
    status_code=status.HTTP_200_OK,
    summary="Get My BnB Listings",
)
async def get_my_bnb_listings(
    pagination: PaginationParams = Depends(),
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[BnbListingRead]:
    listings, total = await BnbService.get_agent_bnb_listings(
        db=db, user=user, pagination=pagination
    )
    items = [_to_read(l, None) for l in listings]
    return PaginatedResponse.create(
        items=items, total=total, page=pagination.page, limit=pagination.limit
    )


@router.get(
    "/my/{listing_id}",
    response_model=BnbListingRead,
    status_code=status.HTTP_200_OK,
    summary="Get a BnB Listing for Editing",
)
async def get_my_bnb_listing_for_edit(
    listing_id: str,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> BnbListingRead:
    listing, bnb = await BnbService.get_bnb_listing_for_edit(
        db=db,
        listing_id=listing_id,
        user=user,
    )
    return _to_read(listing, bnb)


@router.get(
    "/{listing_id}",
    response_model=BnbListingRead,
    status_code=status.HTTP_200_OK,
    summary="Get BnB Listing",
)
async def get_bnb_listing(
    listing_id: str,
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> BnbListingRead:
    listing, bnb = await BnbService.get_bnb_listing(db=db, listing_id=listing_id)
    if not listing.is_active:
        raise NotFoundException(f"BnB listing '{listing_id}' not found")
    return _to_read(listing, bnb)
