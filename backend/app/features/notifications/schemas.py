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
    message: str
    type: str
    read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
