import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.feedback.models import Feedback
from app.features.feedback.schemas import FeedbackCreate


class FeedbackService:
    @staticmethod
    async def create_feedback(
        db: AsyncSession,
        data: FeedbackCreate,
        user: Optional[AuthenticatedUser] = None,
    ) -> Feedback:
        fb = Feedback(
            id=str(uuid.uuid4()),
            listing_id=data.listing_id,
            content=data.content,
            user_email=data.user_email or (user.email if user else None),
            user_id=user.id if user else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(fb)
        await db.flush()
        return fb

    @staticmethod
    async def list_feedback(
        db: AsyncSession,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[Feedback], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=20)

        stmt = select(Feedback)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(Feedback.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
        res = await db.execute(stmt)
        return list(res.scalars().all()), total
