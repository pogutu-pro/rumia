from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_current_user, get_optional_current_user
from app.core.tasks.worker import send_push_to_user
from app.features.tours.schemas import (
    MyTourBookingRead,
    TourBookingCreate,
    TourBookingRead,
    TourBookingStudentUpdate,
    TourBookingUpdateStatus,
    TourListingBrief,
)
from app.features.tours.service import TourService

router = APIRouter(prefix="/tours", tags=["Tours"])


def _schedule_pushes(background_tasks: BackgroundTasks, pushes) -> None:
    for push in pushes:
        background_tasks.add_task(
            send_push_to_user, push.user_id, push.title, push.body, {"url": push.url, "type": "tour"}
        )


@router.post(
    "",
    response_model=TourBookingRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Tour Booking",
    description=(
        "Book a hostel tour. Public (optional auth; a signed-in student is linked to the booking). "
        "The amount is always the zone's configured price, computed server-side. "
        "400 when the zone has no price, the date is in the past, or the phone is invalid."
    ),
)
@limiter.limit("10/minute")
async def create_booking(
    request: Request,
    data: TourBookingCreate,
    background_tasks: BackgroundTasks,
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> TourBookingRead:
    booking, pushes = await TourService.create_booking(db, data, user)
    _schedule_pushes(background_tasks, pushes)
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
    description=(
        "Move a booking through its lifecycle. The booking's agent or an admin may apply any allowed "
        "transition (use `contacted` once the student has been messaged); the student who owns the "
        "booking may only cancel it while pending_payment/confirmed."
    ),
)
async def update_booking_status(
    booking_id: str,
    data: TourBookingUpdateStatus,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> TourBookingRead:
    booking, pushes = await TourService.update_booking_status(db, user, booking_id, data)
    _schedule_pushes(background_tasks, pushes)
    return TourBookingRead.model_validate(booking)


@router.patch(
    "/{booking_id}",
    response_model=TourBookingRead,
    status_code=status.HTTP_200_OK,
    summary="Edit My Booking",
    description="Student edits date/time/phone of their own booking while it is pending payment.",
)
async def update_my_booking(
    booking_id: str,
    data: TourBookingStudentUpdate,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> TourBookingRead:
    booking, pushes = await TourService.update_my_booking(db, user, booking_id, data)
    _schedule_pushes(background_tasks, pushes)
    return TourBookingRead.model_validate(booking)


@router.delete(
    "/{booking_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Booking",
    description="Permanently delete a booking. The booking's agent or an admin only.",
)
async def delete_booking(
    booking_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await TourService.delete_booking(db, user, booking_id)
