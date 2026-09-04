from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.security import AuthenticatedUser, get_current_user
from app.features.listings.schemas import ListingRead
from app.features.profiles.schemas import (
    ProfileRead,
    ProfileUpdate,
    SavedHostelActionResponse,
    SetHomeCampusRequest,
)
from app.features.profiles.service import ProfileService

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get(
    "/me",
    response_model=ProfileRead,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description="Fetch profile of currently authenticated user. Authenticated.",
)
async def get_my_profile(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ProfileRead:
    profile = await ProfileService.get_or_create_profile(db, user)
    return ProfileRead.model_validate(profile)


@router.patch(
    "/me",
    response_model=ProfileRead,
    status_code=status.HTTP_200_OK,
    summary="Update Profile",
    description="Update profile preferences. Authenticated.",
)
async def update_my_profile(
    data: ProfileUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ProfileRead:
    profile = await ProfileService.update_profile(db, user, data)
    return ProfileRead.model_validate(profile)


@router.post(
    "/me/campus",
    response_model=ProfileRead,
    status_code=status.HTTP_200_OK,
    summary="Set Home Campus",
    description="Set primary student campus. Authenticated.",
)
async def set_home_campus(
    req: SetHomeCampusRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ProfileRead:
    profile = await ProfileService.set_home_campus(db, user, req)
    return ProfileRead.model_validate(profile)


@router.get(
    "/me/saved",
    response_model=PaginatedResponse[ListingRead],
    status_code=status.HTTP_200_OK,
    summary="Get Saved Hostels",
    description="Retrieve user's saved hostels. Authenticated.",
)
async def get_saved_hostels(
    pagination: PaginationParams = Depends(),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ListingRead]:
    listings, total = await ProfileService.get_saved_hostels(db, user, pagination)
    items = []
    for item in listings:
        read = ListingRead.model_validate(item)
        read.is_saved = True
        items.append(read)
    return PaginatedResponse.create(
        items=items, total=total, page=pagination.page, limit=pagination.limit
    )


@router.get(
    "/me/saved/{listing_id}",
    response_model=SavedHostelActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Saved State",
    description="Check whether the current user has saved a hostel. Authenticated.",
)
async def get_saved_state(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SavedHostelActionResponse:
    return await ProfileService.get_saved_state(db, user, listing_id)


@router.post(
    "/me/saved/{listing_id}",
    response_model=SavedHostelActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Save Hostel",
    description="Save a hostel to current user's favorites. Authenticated.",
)
async def save_hostel(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SavedHostelActionResponse:
    return await ProfileService.save_hostel(db, user, listing_id)


@router.delete(
    "/me/saved/{listing_id}",
    response_model=SavedHostelActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Unsave Hostel",
    description="Remove a hostel from current user's favorites. Authenticated.",
)
async def unsave_hostel(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> SavedHostelActionResponse:
    return await ProfileService.unsave_hostel(db, user, listing_id)

