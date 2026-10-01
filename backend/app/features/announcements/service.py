import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.scope import require_campus_scope
from app.core.security import AuthenticatedUser
from app.features.announcements.models import Announcement
from app.features.announcements.schemas import AnnouncementCreate, AnnouncementUpdate


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
        await require_campus_scope(db, user, data.campus_id, "You can only post announcements for campuses you manage")

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
        await require_campus_scope(db, user, str(ann.campus_id), "You can only delete announcements for campuses you manage")

        await db.delete(ann)
        await db.flush()

    @staticmethod
    async def update_announcement(
        db: AsyncSession, user: AuthenticatedUser, announcement_id: str, data: AnnouncementUpdate
    ) -> Announcement:
        if not user.is_manager and not user.is_admin:
            raise ForbiddenException("Only managers and admins can edit announcements")
        res = await db.execute(select(Announcement).where(Announcement.id == announcement_id))
        ann = res.scalar_one_or_none()
        if not ann:
            raise NotFoundException(f"Announcement '{announcement_id}' not found")
        await require_campus_scope(db, user, str(ann.campus_id), "You can only edit announcements for campuses you manage")
        if data.campus_id and data.campus_id != str(ann.campus_id):
            await require_campus_scope(db, user, data.campus_id, "You can only post announcements for campuses you manage")
            ann.campus_id = data.campus_id
        for field in ("title", "message", "type", "expires_at"):
            value = getattr(data, field)
            if value is not None:
                setattr(ann, field, value)
        ann.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return ann

    @staticmethod
    async def list_managed(db: AsyncSession, user: AuthenticatedUser) -> List[Announcement]:
        """All announcements (including expired) for the campuses in the caller's scope."""
        from app.core.scope import allowed_campus_ids

        allowed = await allowed_campus_ids(db, user)
        if allowed is not None and not allowed:
            return []
        stmt = select(Announcement).order_by(Announcement.created_at.desc())
        if allowed is not None:
            stmt = stmt.where(Announcement.campus_id.in_(allowed))
        return list((await db.execute(stmt)).scalars().all())
