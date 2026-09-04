"""Expo Push Service transport for native mobile notifications."""
import logging
from typing import Any, Dict, Literal, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

ExpoPushStatus = Literal["delivered", "stale", "failed", "skipped"]


class ExpoPushService:
    """Send notifications through Expo's HTTP push API."""

    SEND_URL = "https://exp.host/--/api/v2/push/send"
    STALE_ERRORS = {"DeviceNotRegistered"}

    @staticmethod
    def is_expo_push_token(token: str) -> bool:
        return token.startswith("ExpoPushToken[") or token.startswith("ExponentPushToken[")

    @staticmethod
    async def send_push(
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> ExpoPushStatus:
        if not ExpoPushService.is_expo_push_token(token):
            logger.info("Skipping non-Expo push token")
            return "skipped"

        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
        }
        if settings.EXPO_PUSH_ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {settings.EXPO_PUSH_ACCESS_TOKEN}"

        payload = {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": data or {},
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(ExpoPushService.SEND_URL, json=payload, headers=headers)
                response.raise_for_status()
                ticket = response.json()
        except Exception as exc:
            logger.warning("Expo push delivery failed: %s", exc)
            return "failed"

        if ticket.get("errors"):
            logger.warning("Expo push returned request errors: %s", ticket["errors"])
            return "failed"

        data_obj = ticket.get("data")
        if isinstance(data_obj, list):
            data_obj = data_obj[0] if data_obj else None
        if not isinstance(data_obj, dict):
            logger.warning("Expo push returned an unexpected ticket: %s", ticket)
            return "failed"

        if data_obj.get("status") == "ok":
            return "delivered"

        details = data_obj.get("details") or {}
        if details.get("error") in ExpoPushService.STALE_ERRORS:
            return "stale"

        logger.warning("Expo push returned ticket error: %s", data_obj)
        return "failed"
