from datetime import datetime, timezone
from typing import Iterable, List, Set, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.listings.models import Listing
from app.features.profiles.models import UserProfile, Wishlist
from app.features.profiles.schemas import ProfileUpdate, SetHomeCampusRequest, WishlistActionResponse


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

        if data.full_name is not None:
            profile.full_name = data.full_name
        if data.phone is not None:
            profile.phone = data.phone
        if data.avatar_url is not None:
            profile.avatar_url = data.avatar_url
        if data.home_campus_id is not None:
            profile.home_campus_id = data.home_campus_id
        if data.home_campus_name is not None:
            profile.home_campus_name = data.home_campus_name
        if data.home_campus_confirmed is not None:
            profile.home_campus_confirmed = data.home_campus_confirmed

        profile.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return profile

    @staticmethod
    async def set_home_campus(db: AsyncSession, user: AuthenticatedUser, req: SetHomeCampusRequest) -> UserProfile:
        profile = await ProfileService.get_or_create_profile(db, user)
        profile.home_campus_id = req.campus_id
        profile.home_campus_name = req.campus_name
        profile.home_campus_confirmed = True
        profile.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return profile

    @staticmethod
    async def save_hostel(
        db: AsyncSession, user: AuthenticatedUser, listing_id: str
    ) -> WishlistActionResponse:
        res = await db.execute(select(Listing).where(Listing.id == listing_id))
        listing = res.scalar_one_or_none()
        if not listing:
            raise NotFoundException("Listing not found")

        existing = await db.execute(
            select(Wishlist).where(
                Wishlist.user_id == user.id, Wishlist.listing_id == listing_id
            )
        )
        saved = existing.scalar_one_or_none()
        if not saved:
            saved = Wishlist(user_id=user.id, listing_id=listing_id)
            db.add(saved)
            await db.flush()

        return WishlistActionResponse(
            message="Hostel saved successfully", is_saved=True, listing_id=listing_id
        )

    @staticmethod
    async def unsave_hostel(
        db: AsyncSession, user: AuthenticatedUser, listing_id: str
    ) -> WishlistActionResponse:
        existing = await db.execute(
            select(Wishlist).where(
                Wishlist.user_id == user.id, Wishlist.listing_id == listing_id
            )
        )
        saved = existing.scalar_one_or_none()
        if saved:
            await db.delete(saved)
            await db.flush()

        return WishlistActionResponse(
            message="Hostel unsaved successfully", is_saved=False, listing_id=listing_id
        )

    @staticmethod
    async def get_saved_state(
        db: AsyncSession, user: AuthenticatedUser, listing_id: str
    ) -> WishlistActionResponse:
        existing = await db.execute(
            select(Wishlist).where(
                Wishlist.user_id == user.id, Wishlist.listing_id == listing_id
            )
        )
        is_saved = existing.scalar_one_or_none() is not None
        return WishlistActionResponse(
            message="Hostel saved" if is_saved else "Hostel not saved",
            is_saved=is_saved,
            listing_id=listing_id,
        )

    @staticmethod
    async def get_saved_hostels(
        db: AsyncSession, user: AuthenticatedUser, pagination: PaginationParams
    ) -> Tuple[List[Listing], int]:
        count_res = await db.execute(
            select(func.count(Wishlist.id)).where(Wishlist.user_id == user.id)
        )
        total = count_res.scalar_one() or 0

        stmt = (
            select(Listing)
            .join(Wishlist, Wishlist.listing_id == Listing.id)
            .options(
                selectinload(Listing.agent),
                selectinload(Listing.images),
                selectinload(Listing.room_types),
            )
            .where(Wishlist.user_id == user.id)
            .order_by(Wishlist.created_at.desc())
            .offset(pagination.offset)
            .limit(pagination.limit)
        )
        res = await db.execute(stmt)
        listings = list(res.scalars().all())
        return listings, total

    @staticmethod
    async def get_saved_listing_ids(
        db: AsyncSession,
        user: AuthenticatedUser,
        listing_ids: Iterable[str],
    ) -> Set[str]:
        ids = [str(listing_id) for listing_id in listing_ids if listing_id]
        if not ids:
            return set()

        res = await db.execute(
            select(Wishlist.listing_id).where(
                Wishlist.user_id == user.id,
                Wishlist.listing_id.in_(ids),
            )
        )
        return {str(listing_id) for listing_id in res.scalars().all()}
