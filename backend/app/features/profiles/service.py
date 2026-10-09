from datetime import datetime, timezone
from typing import Iterable, List, Optional, Set, Tuple
import re

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.errors import NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.core.telemetry import capture_error, capture_event
from app.features.campuses.models import Campus
from app.features.listings.models import Agent, Listing
from app.features.profiles.models import UserProfile, Wishlist
from app.features.profiles.schemas import ProfileUpdate, SetHomeCampusRequest, WishlistActionResponse


STAFF_ROLES = ("agent", "admin", "manager", "super_admin")


class ProfileService:
    @staticmethod
    async def sync_login(
        db: AsyncSession,
        user: AuthenticatedUser,
        full_name: Optional[str],
        avatar_url: Optional[str],
    ) -> Tuple[UserProfile, int]:
        """Post-login bookkeeping (replaces the OAuth callback's direct DB writes).

        - makes sure a profile row exists (new users get the default campus as home campus);
        - re-derives school verification from the *verified token email* on every login;
        - mirrors the provider's display name/avatar when given;
        - links guest tour bookings whose phone matches the profile's phone.
        Returns the profile and the number of bookings linked.
        """
        profile = await ProfileService.get_or_create_profile(db, user)
        if profile.home_campus_id is None and profile.campus_id is not None and profile.home_campus_confirmed_at is None:
            profile.home_campus_id = profile.campus_id

        email = user.email.strip().lower() if user.email else None
        is_school = bool(email) and email.lower().endswith(tuple(f"@{d}" for d in settings.SCHOOL_EMAIL_DOMAINS))
        profile.email = email
        profile.school_verified = is_school
        profile.school_email = email if is_school else None
        if full_name:
            profile.full_name = full_name
        if avatar_url:
            profile.avatar_url = avatar_url
        profile.updated_at = datetime.now(timezone.utc)

        linked = 0
        # Compare the last 9 digits so 0712…, 712… and +254712… all match the same Kenyan number.
        digits = re.sub(r"\D", "", profile.phone or "")[-9:]
        if len(digits) >= 7:
            ids = await db.execute(
                text(
                    """
                    SELECT id FROM public.tour_bookings
                    WHERE linked_user_id IS NULL AND right(regexp_replace(phone, '\\D', '', 'g'), :n) = :digits
                    ORDER BY created_at DESC LIMIT 10
                    """
                ),
                {"digits": digits, "n": len(digits)},
            )
            booking_ids = [str(row[0]) for row in ids.fetchall()]
            if booking_ids:
                await db.execute(
                    text("UPDATE public.tour_bookings SET linked_user_id = CAST(:u AS uuid) WHERE id = ANY(CAST(:ids AS uuid[]))"),
                    {"u": user.id, "ids": booking_ids},
                )
                linked = len(booking_ids)
        await db.flush()
        return profile, linked

    @staticmethod
    async def email_exists(db: AsyncSession, email: str) -> bool:
        res = await db.execute(
            select(UserProfile.id).where(func.lower(UserProfile.email) == email.strip().lower()).limit(1)
        )
        return res.scalar_one_or_none() is not None

    @staticmethod
    async def get_agent_id(db: AsyncSession, user_id: str) -> str | None:
        """Return the id of the agent record owned by this user, if any."""
        result = await db.execute(select(Agent.id).where(Agent.user_id == user_id))
        agent_id = result.scalar_one_or_none()
        return str(agent_id) if agent_id else None

    @staticmethod
    async def get_or_create_profile(db: AsyncSession, user: AuthenticatedUser) -> UserProfile:
        res = await db.execute(select(UserProfile).where(UserProfile.id == user.id))
        profile = res.scalar_one_or_none()
        if not profile:
            # The live profiles table constrains campus_id to NOT NULL. The
            # signup auth hook normally stamps it with DeKUT before the API is
            # ever called, so mirror that default here to keep the create path
            # safe when no profile row exists yet.
            campus_id = None
            default = await db.execute(
                select(Campus.id).where(Campus.slug == settings.DEFAULT_CAMPUS_SLUG).limit(1)
            )
            if default_id := default.scalar_one_or_none():
                campus_id = str(default_id)
            profile = UserProfile(
                id=user.id,
                email=user.email,
                role=user.role,
                managed_campus_id=user.managed_campus_id,
                managed_region_id=user.managed_region_id,
                campus_id=campus_id,
                school_verified=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(profile)
            try:
                await db.flush()
            except Exception as exc:
                capture_error(
                    "profile_completion_failed",
                    exc,
                    user_id=user.id,
                    extra={"stage": "create_row", "campus_defaulted": bool(campus_id)},
                )
                raise
            capture_event(
                "profile_created",
                distinct_id=user.id,
                properties={"campus_defaulted": bool(campus_id)},
            )
        return profile

    @staticmethod
    async def update_profile(db: AsyncSession, user: AuthenticatedUser, data: ProfileUpdate) -> UserProfile:
        profile = await ProfileService.get_or_create_profile(db, user)

        try:
            if data.full_name is not None:
                profile.full_name = data.full_name
            if data.phone is not None:
                profile.phone = data.phone
            if data.avatar_url is not None:
                profile.avatar_url = data.avatar_url

            if data.campus_input is not None:
                campus = await db.execute(
                    select(Campus).where(Campus.name.ilike(data.campus_input.strip())).limit(1)
                )
                matched = campus.scalar_one_or_none()
                if matched:
                    profile.home_campus_id = matched.id
                    profile.home_campus_name = data.campus_input.strip()
                else:
                    # A university outside the registry: keep the typed name and drop the default
                    # campus sign-up pinned, otherwise this student is silently treated as DeKUT.
                    profile.home_campus_id = None
                    profile.home_campus_name = data.campus_input.strip()
                if profile.home_campus_confirmed_at is None:
                    profile.home_campus_confirmed_at = datetime.now(timezone.utc)

            if data.home_campus_id is not None:
                profile.home_campus_id = data.home_campus_id
            if data.home_campus_name is not None:
                profile.home_campus_name = data.home_campus_name
            if data.home_campus_confirmed is not None:
                if data.home_campus_confirmed:
                    if profile.home_campus_confirmed_at is None:
                        profile.home_campus_confirmed_at = datetime.now(timezone.utc)
                else:
                    profile.home_campus_confirmed_at = None
            if data.home_campus_confirmed_at is not None:
                profile.home_campus_confirmed_at = data.home_campus_confirmed_at

            profile.updated_at = datetime.now(timezone.utc)
            await db.flush()
        except Exception as exc:
            capture_error(
                "profile_completion_failed",
                exc,
                user_id=user.id,
                extra={
                    "stage": "update_flush",
                    "had_phone": data.phone is not None,
                    "had_campus": data.campus_input is not None or data.home_campus_id is not None,
                    "confirming": bool(data.home_campus_confirmed),
                },
            )
            raise

        if data.home_campus_confirmed:
            capture_event(
                "profile_completion_succeeded",
                distinct_id=user.id,
                properties={"campus": profile.home_campus_name or None},
            )
        return profile

    @staticmethod
    async def set_home_campus(db: AsyncSession, user: AuthenticatedUser, req: SetHomeCampusRequest) -> UserProfile:
        profile = await ProfileService.get_or_create_profile(db, user)
        profile.home_campus_id = str(req.campus_id)
        profile.home_campus_name = req.campus_name
        if profile.home_campus_confirmed_at is None:
            profile.home_campus_confirmed_at = datetime.now(timezone.utc)
        profile.updated_at = datetime.now(timezone.utc)
        try:
            await db.flush()
        except Exception as exc:
            capture_error(
                "profile_completion_failed",
                exc,
                user_id=user.id,
                extra={"stage": "set_campus_flush"},
            )
            raise
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
