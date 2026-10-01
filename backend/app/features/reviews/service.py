import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser, check_campus_scope
from app.features.listings.models import Listing
from app.features.profiles.models import UserProfile
from app.features.reviews.models import Review, ReviewLike, ReviewModerationLog, ReviewReply
from app.features.reviews.schemas import ReviewCreate, ReviewModerationAction, ReviewReplyCreate, ReviewUpdate


LEGACY_NO_TEXT = "No written review provided."


class ReviewService:
    @staticmethod
    async def list_reviews(
        db: AsyncSession,
        listing_id: Optional[str] = None,
        status_filter: str = "published",
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[Review], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=10)

        stmt = select(Review)
        if listing_id:
            stmt = stmt.where(Review.listing_id == listing_id)
        if status_filter:
            stmt = stmt.where(Review.status == status_filter)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(Review.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
        res = await db.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_review_by_id(db: AsyncSession, review_id: str) -> Review:
        res = await db.execute(select(Review).where(Review.id == review_id))
        review = res.scalar_one_or_none()
        if not review:
            raise NotFoundException(f"Review with id '{review_id}' not found")
        return review

    @staticmethod
    async def _profile(db: AsyncSession, user_id: str) -> Optional[UserProfile]:
        res = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
        return res.scalar_one_or_none()

    @staticmethod
    async def _can_moderate(db: AsyncSession, user: AuthenticatedUser, listing_id: str) -> bool:
        """Admins always; managers only for listings on a campus they manage."""
        if user.is_admin:
            return True
        if user.role != "manager":
            return False
        res = await db.execute(select(Listing.campus_id).where(Listing.id == listing_id))
        campus_id = res.scalar_one_or_none()
        return bool(campus_id) and await check_campus_scope(user, str(campus_id), db)

    @staticmethod
    async def create_review(db: AsyncSession, user: AuthenticatedUser, data: ReviewCreate) -> Review:
        """Rules ported from the former web action:
        - written text is only for school-verified students (ratings alone are open to everyone);
        - one review per user per listing (409 ALREADY_REVIEWED);
        - author name/avatar and school-verification are snapshotted from the profile, never
          taken from the request.
        """
        text_value = (data.text or "").strip() or None
        if text_value == LEGACY_NO_TEXT:  # placeholder sent by older mobile builds
            text_value = None
        profile = await ReviewService._profile(db, user.id)
        verified = bool(profile and profile.school_verified)
        if text_value and not verified:
            raise ForbiddenException(
                "Only verified DeKUT students can write review text. You can still submit a rating."
            )

        existing = await db.execute(
            select(Review.id).where(Review.listing_id == data.listing_id, Review.user_id == user.id).limit(1)
        )
        if existing.scalar_one_or_none():
            raise ConflictException(
                code="ALREADY_REVIEWED",
                message="You have already reviewed this hostel. You can edit your existing review.",
            )

        review = Review(
            id=str(uuid.uuid4()),
            listing_id=data.listing_id,
            user_id=user.id,
            rating=data.rating,
            text=text_value,
            school_verified_at_review_time=verified,
            status="published",
            author_name=(profile.full_name if profile else None),
            author_avatar_url=(profile.avatar_url if profile else None),
            rating_cleanliness=data.rating_cleanliness,
            rating_security=data.rating_security,
            rating_water=data.rating_water,
            rating_wifi=data.rating_wifi,
            rating_facilities=data.rating_facilities,
            rating_location=data.rating_location,
            rating_management=data.rating_management,
            rating_value=data.rating_value,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(review)
        await db.flush()
        # A brand-new row has not loaded its relationships; serializing it would lazy-load
        # outside the async context (MissingGreenlet).
        await db.refresh(review, attribute_names=["likes", "replies"])
        return review

    @staticmethod
    async def update_review(db: AsyncSession, user: AuthenticatedUser, review_id: str, data: ReviewUpdate) -> Review:
        """Author-only edit (moderators use the moderate endpoint). Sending `text: null` clears the text;
        adding text to a text-less review requires school verification."""
        review = await ReviewService.get_review_by_id(db, review_id)
        if str(review.user_id) != user.id:
            raise ForbiddenException("You can only edit your own review")

        if "text" in data.model_fields_set:
            new_text = (data.text or "").strip() or None
            if new_text and not review.text:
                profile = await ReviewService._profile(db, user.id)
                if not (profile and profile.school_verified):
                    raise ForbiddenException("Only verified DeKUT students can add review text.")
            review.text = new_text
        if data.rating is not None:
            review.rating = data.rating
        for field in (
            "rating_cleanliness", "rating_security", "rating_water", "rating_wifi",
            "rating_facilities", "rating_location", "rating_management", "rating_value",
        ):
            if field in data.model_fields_set:
                setattr(review, field, getattr(data, field))

        review.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return review

    @staticmethod
    async def delete_review(db: AsyncSession, user: AuthenticatedUser, review_id: str) -> None:
        """Authors delete their own review; admins/campus managers delete with an audit entry."""
        review = await ReviewService.get_review_by_id(db, review_id)
        if str(review.user_id) != user.id:
            if not await ReviewService._can_moderate(db, user, str(review.listing_id)):
                raise ForbiddenException("You can only delete your own review")
            db.add(ReviewModerationLog(
                id=str(uuid.uuid4()), review_id=review.id, review_listing_id=review.listing_id,
                review_user_id=review.user_id, actor_user_id=user.id, action="delete",
                previous_status=review.status, previous_text=review.text, previous_rating=review.rating,
            ))
        await db.delete(review)
        await db.flush()

    @staticmethod
    async def toggle_like(db: AsyncSession, user: AuthenticatedUser, review_id: str) -> bool:
        await ReviewService.get_review_by_id(db, review_id)
        res = await db.execute(select(ReviewLike).where(ReviewLike.review_id == review_id, ReviewLike.user_id == user.id))
        existing = res.scalar_one_or_none()
        if existing:
            await db.delete(existing)
            await db.flush()
            return False
        else:
            like = ReviewLike(id=str(uuid.uuid4()), review_id=review_id, user_id=user.id)
            db.add(like)
            await db.flush()
            return True

    @staticmethod
    async def add_reply(db: AsyncSession, user: AuthenticatedUser, review_id: str, data: ReviewReplyCreate) -> ReviewReply:
        await ReviewService.get_review_by_id(db, review_id)
        profile = await ReviewService._profile(db, user.id)
        reply = ReviewReply(
            id=str(uuid.uuid4()),
            review_id=review_id,
            user_id=user.id,
            text=data.text,
            author_name=(profile.full_name if profile else None),
            author_avatar_url=(profile.avatar_url if profile else None),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(reply)
        await db.flush()
        return reply

    @staticmethod
    async def delete_reply(db: AsyncSession, user: AuthenticatedUser, reply_id: str) -> None:
        res = await db.execute(select(ReviewReply).where(ReviewReply.id == reply_id))
        reply = res.scalar_one_or_none()
        if not reply:
            raise NotFoundException(f"Reply with id '{reply_id}' not found")
        if str(reply.user_id) != user.id and not user.is_admin:
            raise ForbiddenException("You can only delete your own reply")
        await db.delete(reply)
        await db.flush()

    @staticmethod
    async def moderate_review(db: AsyncSession, user: AuthenticatedUser, review_id: str, action: ReviewModerationAction) -> Review:
        review = await ReviewService.get_review_by_id(db, review_id)
        if not await ReviewService._can_moderate(db, user, str(review.listing_id)):
            raise ForbiddenException("You can only moderate reviews within your campus")
        status_map = {
            "approve": "published",
            "restore": "published",
            "hide": "hidden",
            "flag": "flagged",
            "reject": "flagged",  # legacy alias: the live status check allows published|hidden|flagged
        }
        previous_status = review.status
        previous_text = review.text
        new_status = status_map.get(action.action, review.status)

        status_changed = new_status != previous_status
        text_changed = action.text is not None and action.text.strip() != (previous_text or "")
        if not status_changed and not text_changed:
            raise BadRequestException("No changes to apply.")
        if status_changed:
            review.status = new_status
        if text_changed:
            review.text = action.text.strip() or None
        review.updated_at = datetime.now(timezone.utc)

        # One audit row per kind of change (the live table allows status_change | text_edit | delete).
        if status_changed:
            db.add(ReviewModerationLog(
                id=str(uuid.uuid4()), review_id=review_id, review_listing_id=review.listing_id,
                review_user_id=review.user_id, actor_user_id=user.id, action="status_change",
                previous_status=previous_status, new_status=new_status, reason=action.note,
            ))
        if text_changed:
            db.add(ReviewModerationLog(
                id=str(uuid.uuid4()), review_id=review_id, review_listing_id=review.listing_id,
                review_user_id=review.user_id, actor_user_id=user.id, action="text_edit",
                previous_text=previous_text, new_text=review.text, reason=action.note,
            ))
        await db.flush()
        return review

    @staticmethod
    async def get_summary(db: AsyncSession, listing_id: str) -> dict:
        try:
            res = await db.execute(text("SELECT public.get_review_summary(:listing_id)"), {"listing_id": listing_id})
            row = res.scalar_one_or_none()
            if row:
                return row
        except Exception:
            pass
        return {"average_rating": 0.0, "total_reviews": 0, "distribution": [], "categories": []}
