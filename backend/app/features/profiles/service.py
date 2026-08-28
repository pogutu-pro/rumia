from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundException
from app.core.security import AuthenticatedUser
from app.features.profiles.models import UserProfile
from app.features.profiles.schemas import ProfileUpdate, SetHomeCampusRequest


class ProfileService:
    @staticmethod
    async def get_or_create_profile(db: AsyncSession, user: AuthenticatedUser) -> UserProfile:
        res = await db.execute(select(UserProfile).where(UserProfile.id == user.id))
        profile = res.scalar_one_or_none()
        if not profile:
            profile = UserProfile(
                id=user.id,
                email=user.email,
                role=user.role,
                managed_campus_id=user.managed_campus_id,
                managed_region_id=user.managed_region_id,
                home_campus_confirmed=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(profile)
            await db.flush()
        return profile

    @staticmethod
    async def update_profile(db: AsyncSession, user: AuthenticatedUser, data: ProfileUpdate) -> UserProfile:
        profile = await ProfileService.get_or_create_profile(db, user)

        if data.home_campus_id is not None:
            profile.home_campus_id = data.home_campus_id
        if data.home_campus_name is not None:
            profile.home_campus_name = data.home_campus_name
        if data.home_campus_confirmed is not None:
            profile.home_campus_confirmed = data.home_campus_confirmed

        await db.flush()
        return profile

    @staticmethod
    async def set_home_campus(db: AsyncSession, user: AuthenticatedUser, req: SetHomeCampusRequest) -> UserProfile:
        profile = await ProfileService.get_or_create_profile(db, user)
        profile.home_campus_id = req.campus_id
        profile.home_campus_name = req.campus_name
        profile.home_campus_confirmed = True
        await db.flush()
        return profile
