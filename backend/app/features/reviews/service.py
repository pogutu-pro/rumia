import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.reviews.models import Review, ReviewLike, ReviewModerationLog, ReviewReply
from app.features.reviews.schemas import ReviewCreate, ReviewModerationAction, ReviewReplyCreate, ReviewUpdate


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
    async def create_review(db: AsyncSession, user: AuthenticatedUser, data: ReviewCreate) -> Review:
        review = Review(
            id=str(uuid.uuid4()),
            listing_id=data.listing_id,
            user_id=user.id,
            rating=data.rating,
            text=data.text,
            stay_start=data.stay_start,
            stay_end=data.stay_end,
            school_verified_at_review_time=False,
            status="published",  # Default auto-publish in backend service
            author_name=data.author_name or "Anonymous Student",
            author_avatar_url=data.author_avatar_url,
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
        return review

    @staticmethod
    async def update_review(db: AsyncSession, user: AuthenticatedUser, review_id: str, data: ReviewUpdate) -> Review:
        review = await ReviewService.get_review_by_id(db, review_id)
        if review.user_id != user.id and not user.is_admin:
            raise ForbiddenException("You can only edit your own review")

        if data.rating is not None:
            review.rating = data.rating
        if data.text is not None:
            review.text = data.text
        if data.rating_cleanliness is not None:
            review.rating_cleanliness = data.rating_cleanliness
        if data.rating_security is not None:
            review.rating_security = data.rating_security
        if data.rating_water is not None:
            review.rating_water = data.rating_water
        if data.rating_wifi is not None:
            review.rating_wifi = data.rating_wifi
        if data.rating_facilities is not None:
            review.rating_facilities = data.rating_facilities
        if data.rating_location is not None:
            review.rating_location = data.rating_location
        if data.rating_management is not None:
            review.rating_management = data.rating_management
        if data.rating_value is not None:
            review.rating_value = data.rating_value

        review.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return review

    @staticmethod
    async def delete_review(db: AsyncSession, user: AuthenticatedUser, review_id: str) -> None:
        review = await ReviewService.get_review_by_id(db, review_id)
        if review.user_id != user.id and not user.is_admin:
            raise ForbiddenException("You can only delete your own review")
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
        reply = ReviewReply(
            id=str(uuid.uuid4()),
            review_id=review_id,
            user_id=user.id,
            text=data.text,
            author_name=user.email or "Verified User",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(reply)
        await db.flush()
        return reply

    @staticmethod
    async def moderate_review(db: AsyncSession, user: AuthenticatedUser, review_id: str, action: ReviewModerationAction) -> Review:
        if not user.is_admin:
            raise ForbiddenException("Only admins can moderate reviews")

        review = await ReviewService.get_review_by_id(db, review_id)
        status_map = {
            "approve": "published",
            "restore": "published",
            "hide": "hidden",
            "reject": "rejected",
        }
        review.status = status_map.get(action.action, review.status)
        review.updated_at = datetime.now(timezone.utc)

        log = ReviewModerationLog(
            id=str(uuid.uuid4()),
            review_id=review_id,
            moderator_id=user.id,
            action=action.action,
            note=action.note,
        )
        db.add(log)
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
