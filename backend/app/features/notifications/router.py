from typing import List
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_current_user
from app.features.notifications.schemas import (
    AppNotificationRead,
    DeviceTokenActionResponse,
    DeviceTokenRegisterRequest,
    NotificationPreferenceActionResponse,
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    PushSubscriptionCreate,
    PushUnsubscribeRequest,
    UnreadCountResponse,
)
from app.features.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post(
    "/devices",
    response_model=DeviceTokenActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Register Device Token",
    description="Register device push token for mobile/FCM notifications. Authenticated.",
)
@limiter.limit("30/minute")
async def register_device_token(
    request: Request,
    data: DeviceTokenRegisterRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> DeviceTokenActionResponse:
    return await NotificationService.register_device_token(db, user, data)


@router.delete(
    "/devices/{token}",
    response_model=DeviceTokenActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Unregister Device Token",
    description="Unregister/deactivate device token on sign-out. Authenticated.",
)
async def unregister_device_token(
    token: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> DeviceTokenActionResponse:
    return await NotificationService.unregister_device_token(db, user, token)


@router.post(
    "/push/subscribe",
    status_code=status.HTTP_201_CREATED,
    summary="Subscribe Push Notifications",
    description="Save Web Push subscription keys. Authenticated.",
)
async def subscribe_push(
    data: PushSubscriptionCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> dict:
    await NotificationService.unsubscribe_push(db, user, data.endpoint)
    return {"message": "Successfully unsubscribed"}


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Unread Notification Count",
    description="Count of unread in-app notifications for the current user. Authenticated.",
)
async def unread_count(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> UnreadCountResponse:
    count = await NotificationService.unread_count(db, user)
    return UnreadCountResponse(count=count)


@router.get(
    "/preferences",
    response_model=NotificationPreferenceRead,
    status_code=status.HTTP_200_OK,
    summary="Get Notification Preferences",
    description="Fetch current user's notification channel preferences. Authenticated.",
)
async def get_preferences(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> NotificationPreferenceRead:
    pref = await NotificationService.list_preferences(db, user)
    return NotificationPreferenceRead.model_validate(pref)


@router.patch(
    "/preferences",
    response_model=NotificationPreferenceActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Notification Preferences",
    description="Update channel opt-ins (email/push) for wishlist notifications. Authenticated.",
)
async def update_preferences(
    data: NotificationPreferenceUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> NotificationPreferenceActionResponse:
    return await NotificationService.update_preferences(db, user, data)


@router.get(
    "",
    response_model=List[AppNotificationRead],
    status_code=status.HTTP_200_OK,
    summary="List User Notifications",
    description="Fetch latest 50 in-app notifications. Authenticated.",
)
async def list_notifications(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> dict:
    await NotificationService.mark_all_read(db, user)
    return {"message": "All notifications marked as read"}

