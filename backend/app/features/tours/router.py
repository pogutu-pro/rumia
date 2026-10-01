from typing import Optional
from fastapi import APIRouter, Depends, Header, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, decode_jwt_token, get_current_user
from app.features.tours.schemas import (
    MyTourBookingRead,
    TourBookingCreate,
    TourBookingRead,
    TourBookingUpdateStatus,
    TourListingBrief,
)
from app.features.tours.service import TourService

router = APIRouter(prefix="/tours", tags=["Tours"])


@router.post(
    "",
    response_model=TourBookingRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Tour Booking",
    description="Book a hostel tour. Public (optional auth).",
)
@limiter.limit("10/minute")
async def create_booking(
    request: Request,
    data: TourBookingCreate,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session),
) -> TourBookingRead:
    user: Optional[AuthenticatedUser] = None
    if authorization and authorization.lower().startswith("bearer "):
        try:
            token = authorization.split()[1]
            token_data = decode_jwt_token(token)
            user = AuthenticatedUser(id=token_data.user_id, email=token_data.email)
        except Exception:
            pass

    booking = await TourService.create_booking(db, data, user)
    return TourBookingRead.model_validate(booking)


@router.get(
    "/me",
    response_model=PaginatedResponse[MyTourBookingRead],
    status_code=status.HTTP_200_OK,
    summary="List My Tour Bookings",
    description=(
        "Fetch tour bookings linked to current student user, each with a brief of its listing "
        "(title, area, county, slug, images). `sort=upcoming` orders by preferred date/time ascending; "
        "default is newest-created first. Authenticated."
    ),
)
async def list_my_tours(
    pagination: PaginationParams = Depends(),
    sort: str = Query("created_desc", pattern="^(created_desc|upcoming)$"),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[MyTourBookingRead]:
    items, total = await TourService.list_my_tours(db, user, pagination=pagination, sort=sort)
    listings = await TourService.get_listings_by_id(db, [b.listing_id for b in items if b.listing_id])
    validated = []
    for booking in items:
        row = MyTourBookingRead.model_validate(booking)
        listing = listings.get(str(booking.listing_id)) if booking.listing_id else None
        if listing is not None:
            row.listing = TourListingBrief.model_validate(listing)
        validated.append(row)
    return PaginatedResponse.create(items=validated, total=total, page=pagination.page, limit=pagination.limit)


@router.get(
    "",
    response_model=PaginatedResponse[TourBookingRead],
    status_code=status.HTTP_200_OK,
    summary="List Tour Bookings",
    description="Fetch tour bookings. Agent sees own, Admin sees all.",
)
async def list_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    pagination: PaginationParams = Depends(),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[TourBookingRead]:
    items, total = await TourService.list_bookings(db, user, status_filter=status_filter, pagination=pagination)
    validated = [TourBookingRead.model_validate(b) for b in items]
    return PaginatedResponse.create(items=validated, total=total, page=pagination.page, limit=pagination.limit)



@router.get(
    "/{booking_id}",
    response_model=TourBookingRead,
    status_code=status.HTTP_200_OK,
    summary="Get Booking Details",
    description="Fetch single booking by ID. Authorized user/agent/admin.",
)
async def get_booking(
    booking_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> TourBookingRead:
    booking = await TourService.get_booking_by_id(db, user, booking_id)
    return TourBookingRead.model_validate(booking)


@router.patch(
    "/{booking_id}/status",
    response_model=TourBookingRead,
    status_code=status.HTTP_200_OK,
    summary="Update Booking Status",
    description="Update booking status (use status `contacted` once the student has been messaged). Agent or Admin.",
)
async def update_booking_status(
    booking_id: str,
    data: TourBookingUpdateStatus,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> TourBookingRead:
    booking = await TourService.update_booking_status(db, user, booking_id, data)
    return TourBookingRead.model_validate(booking)
