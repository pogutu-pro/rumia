from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import AuthenticatedUser, get_current_user, require_roles
from app.features.announcements.schemas import AnnouncementCreate, AnnouncementRead
from app.features.announcements.service import AnnouncementService

router = APIRouter(prefix="/announcements", tags=["Announcements"])


@router.get(
    "",
    response_model=List[AnnouncementRead],
    status_code=status.HTTP_200_OK,
    summary="List Active Announcements",
    description="Fetch unexpired announcements for a campus. Public.",
)
async def list_announcements(
    campus_id: Optional[str] = Query(None, description="Filter by campus ID"),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> List[AnnouncementRead]:
    anns = await AnnouncementService.get_active_announcements(db, campus_id=campus_id)
    return [AnnouncementRead.model_validate(a) for a in anns]


@router.post(
    "",
    response_model=AnnouncementRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Announcement",
    description="Post a new campus announcement. Manager or Admin only.",
)
async def create_announcement(
    data: AnnouncementCreate,
    user: AuthenticatedUser = Depends(require_roles("manager", "admin")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> AnnouncementRead:
    ann = await AnnouncementService.create_announcement(db, user, data)
    return AnnouncementRead.model_validate(ann)


@router.delete(
    "/{announcement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Announcement",
    description="Delete an announcement. Manager or Admin only.",
)
async def delete_announcement(
    announcement_id: str,
    user: AuthenticatedUser = Depends(require_roles("manager", "admin")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> None:
    await AnnouncementService.delete_announcement(db, user, announcement_id)
