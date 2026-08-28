from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import AuthenticatedUser, get_current_user
from app.features.notifications.schemas import AppNotificationRead, PushSubscriptionCreate, PushUnsubscribeRequest
from app.features.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post(
    "/push/subscribe",
    status_code=status.HTTP_201_CREATED,
    summary="Subscribe Push Notifications",
    description="Save Web Push subscription keys. Authenticated.",
)
async def subscribe_push(
    data: PushSubscriptionCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    sub = await NotificationService.subscribe_push(db, user, data)
    return {"id": sub.id, "message": "Successfully subscribed to push notifications"}


@router.delete(
    "/push/unsubscribe",
    status_code=status.HTTP_200_OK,
    summary="Unsubscribe Push Notifications",
    description="Remove Web Push subscription by endpoint. Authenticated.",
)
async def unsubscribe_push(
    data: PushUnsubscribeRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await NotificationService.unsubscribe_push(db, user, data.endpoint)
    return {"message": "Successfully unsubscribed"}


@router.get(
    "",
    response_model=List[AppNotificationRead],
    status_code=status.HTTP_200_OK,
    summary="List User Notifications",
    description="Fetch latest 50 in-app notifications. Authenticated.",
)
async def list_notifications(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> List[AppNotificationRead]:
    notifs = await NotificationService.list_notifications(db, user)
    return [AppNotificationRead.model_validate(n) for n in notifs]


@router.patch(
    "/{notification_id}/read",
    response_model=AppNotificationRead,
    status_code=status.HTTP_200_OK,
    summary="Mark Notification Read",
    description="Mark single notification as read. Authenticated.",
)
async def mark_read(
    notification_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> AppNotificationRead:
    notif = await NotificationService.mark_read(db, user, notification_id)
    return AppNotificationRead.model_validate(notif)


@router.patch(
    "/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark All Notifications Read",
    description="Mark all notifications for current user as read. Authenticated.",
)
async def mark_all_read(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await NotificationService.mark_all_read(db, user)
    return {"message": "All notifications marked as read"}
