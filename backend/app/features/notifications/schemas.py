from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class AppNotificationRead(BaseModel):
    id: str
    user_id: str
    title: str
    body: str
    message: str = ""
    url: Optional[str] = None
    type: str = "info"
    read: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeviceTokenRegisterRequest(BaseModel):
    token: str
    platform: str = "android"


class DeviceTokenActionResponse(BaseModel):
    message: str
    token: str
    is_active: bool


class NotificationPreferenceRead(BaseModel):
    wishlist_push_enabled: bool = True
    wishlist_email_enabled: bool = True
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceUpdate(BaseModel):
    wishlist_push_enabled: Optional[bool] = None
    wishlist_email_enabled: Optional[bool] = None


class NotificationPreferenceActionResponse(BaseModel):
    message: str
    wishlist_push_enabled: bool
    wishlist_email_enabled: bool


class UnreadCountResponse(BaseModel):
    count: int