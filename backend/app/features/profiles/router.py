from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import AuthenticatedUser, get_current_user
from app.features.profiles.schemas import ProfileRead, ProfileUpdate, SetHomeCampusRequest
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
