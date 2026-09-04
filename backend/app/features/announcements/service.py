import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.security import AuthenticatedUser
from app.features.announcements.models import Announcement
from app.features.announcements.schemas import AnnouncementCreate


class AnnouncementService:
    @staticmethod
    async def get_active_announcements(db: AsyncSession, campus_id: Optional[str] = None) -> List[Announcement]:
        now = datetime.now(timezone.utc)
        stmt = select(Announcement).where(Announcement.expires_at > now)
        if campus_id:
            stmt = stmt.where(Announcement.campus_id == campus_id)
        stmt = stmt.order_by(Announcement.expires_at.desc())
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_announcement(db: AsyncSession, user: AuthenticatedUser, data: AnnouncementCreate) -> Announcement:
        if not user.is_manager and not user.is_admin:
            raise ForbiddenException("Only managers and admins can create announcements")

        ann = Announcement(
            id=str(uuid.uuid4()),
            campus_id=data.campus_id,
            title=data.title,
            message=data.message,
            type=data.type,
            created_by=user.id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            expires_at=data.expires_at,
        )
        db.add(ann)
        await db.flush()
        return ann

    @staticmethod
    async def delete_announcement(db: AsyncSession, user: AuthenticatedUser, announcement_id: str) -> None:
        if not user.is_manager and not user.is_admin:
            raise ForbiddenException("Only managers and admins can delete announcements")

        res = await db.execute(select(Announcement).where(Announcement.id == announcement_id))
        ann = res.scalar_one_or_none()
        if not ann:
            raise NotFoundException(f"Announcement '{announcement_id}' not found")

        await db.delete(ann)
        await db.flush()
