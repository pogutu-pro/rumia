from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.pagination import PaginatedResponse, PaginationParams
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_current_user
from app.features.listings.schemas import ListingRead
from app.features.profiles.schemas import (
    EmailExistsResponse,
    LoginSyncRequest,
    LoginSyncResponse,
    ProfileRead,
    ProfileUpdate,
    SavedHostelActionResponse,
    SetHomeCampusRequest,
    WishlistActionResponse,
    WishlistBatchCheckRequest,
    WishlistBatchCheckResponse,
)
from app.features.profiles.service import STAFF_ROLES, ProfileService

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get(
    "/check-email",
    response_model=EmailExistsResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Email Registered",
    description=(
        "Whether a profile exists for an email. Public and rate-limited; used only to give a "
        "helpful message after a failed password sign-in."
    ),
)
@limiter.limit("10/minute")
async def check_email(
    request: Request,
    email: str = Query(..., min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> EmailExistsResponse:
    return EmailExistsResponse(exists=await ProfileService.email_exists(db, email))


@router.get(
    "/me",
    response_model=ProfileRead,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description="Fetch profile of currently authenticated user. Authenticated.",
)
async def get_my_profile(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> ProfileRead:
    profile = await ProfileService.get_or_create_profile(db, user)
    result = ProfileRead.model_validate(profile)
    result.agent_id = await ProfileService.get_agent_id(db, user.id)
    return result


@router.post(
    "/me/sync-login",
    response_model=LoginSyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Post-Login Profile Sync",
    description=(
        "Call once after OAuth sign-in: ensures the profile exists, re-derives school "
        "verification from the token's email, mirrors the provider's name/avatar, links guest "
        "tour bookings with the user's phone, and reports whether the profile still needs "
        "completing. Authenticated."
    ),
)
async def sync_login(
    data: LoginSyncRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> LoginSyncResponse:
    profile, linked = await ProfileService.sync_login(db, user, data.full_name, data.avatar_url)
    is_staff = (profile.role or "") in STAFF_ROLES
    incomplete = not (profile.phone or "").strip() or profile.home_campus_confirmed_at is None
    return LoginSyncResponse(
        role=profile.role or "student",
        needs_profile_completion=(not is_staff) and incomplete,
        linked_bookings=linked,
    )


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
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> ProfileRead:
    profile = await ProfileService.set_home_campus(db, user, req)
    return ProfileRead.model_validate(profile)


@router.get(
    "/me/wishlist",
    response_model=PaginatedResponse[ListingRead],
    status_code=status.HTTP_200_OK,
    summary="Get Wishlist",
    description="Retrieve current user's wishlisted hostels. Authenticated.",
)
async def get_wishlist(
    pagination: PaginationParams = Depends(),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
    "/me/saved",
    response_model=PaginatedResponse[ListingRead],
    status_code=status.HTTP_200_OK,
    summary="Get Saved Hostels (deprecated)",
    description="Alias of GET /profiles/me/wishlist. Deprecated; will be removed. Authenticated.",
    deprecated=True,
)
async def get_saved_hostels(
    pagination: PaginationParams = Depends(),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> PaginatedResponse[ListingRead]:
    return await get_wishlist(pagination, user, db)


@router.post(
    "/me/wishlist/batch-check",
    response_model=WishlistBatchCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Batch Check Wishlist State",
    description="Check wishlist state for multiple listings in a single request. "
    "Accepts up to 100 listing IDs. Authenticated.",
)
async def batch_check_wishlist(
    body: WishlistBatchCheckRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> WishlistBatchCheckResponse:
    # Cap at 100 to prevent abuse
    ids = body.ids[:100]
    saved_ids = await ProfileService.get_saved_listing_ids(db, user, ids)
    return WishlistBatchCheckResponse(
        saved={lid: lid in saved_ids for lid in ids}
    )


@router.get(
    "/me/wishlist/{listing_id}",
    response_model=WishlistActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Wishlist State",
    description="Check whether the current user has wishlisted a hostel. Authenticated.",
)
async def get_wishlist_state(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> WishlistActionResponse:
    return await ProfileService.get_saved_state(db, user, listing_id)


@router.post(
    "/me/wishlist/{listing_id}",
    response_model=WishlistActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Wishlist Hostel",
    description="Add a hostel to the current user's wishlist. Authenticated.",
)
async def wishlist_hostel(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> WishlistActionResponse:
    return await ProfileService.save_hostel(db, user, listing_id)


@router.delete(
    "/me/wishlist/{listing_id}",
    response_model=WishlistActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove From Wishlist",
    description="Remove a hostel from the current user's wishlist. Authenticated.",
)
async def unwishlist_hostel(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> WishlistActionResponse:
    return await ProfileService.unsave_hostel(db, user, listing_id)


@router.get(
    "/me/saved/{listing_id}",
    response_model=SavedHostelActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Saved State (deprecated)",
    description="Alias of GET /profiles/me/wishlist/{listing_id}. Deprecated. Authenticated.",
    deprecated=True,
)
async def get_saved_state(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> SavedHostelActionResponse:
    return await ProfileService.get_saved_state(db, user, listing_id)


@router.post(
    "/me/saved/{listing_id}",
    response_model=SavedHostelActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Save Hostel (deprecated)",
    description="Alias of POST /profiles/me/wishlist/{listing_id}. Deprecated. Authenticated.",
    deprecated=True,
)
async def save_hostel(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> SavedHostelActionResponse:
    return await ProfileService.save_hostel(db, user, listing_id)


@router.delete(
    "/me/saved/{listing_id}",
    response_model=SavedHostelActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Unsave Hostel (deprecated)",
    description="Alias of DELETE /profiles/me/wishlist/{listing_id}. Deprecated. Authenticated.",
    deprecated=True,
)
async def unsave_hostel(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> SavedHostelActionResponse:
    return await ProfileService.unsave_hostel(db, user, listing_id)

