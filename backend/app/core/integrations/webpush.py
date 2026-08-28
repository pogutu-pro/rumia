"""VAPID Web Push integration with automatic stale subscription pruning."""
import json
import logging
from typing import Any, Dict, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class WebPushService:
    """Sends VAPID-signed Web Push notifications and handles stale endpoint cleanup."""

    @staticmethod
    def _get_vapid_claims() -> Dict[str, str]:
        return {"sub": settings.VAPID_SUBJECT}

    @staticmethod
    def send_push(
        subscription_info: Dict[str, Any],
        title: str,
        body: str,
        data: Optional[Dict] = None,
        icon: str = "/icons/icon-192x192.png",
    ) -> bool:
        """
        Send a web push notification to a single subscription endpoint.

        Returns True if delivered, False if endpoint is stale (should be removed).
        """
        if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
            logger.warning("VAPID keys not configured — skipping web push")
            return False

        try:
            from pywebpush import webpush, WebPushException

            payload = json.dumps({
                "title": title,
                "body": body,
                "icon": icon,
                "data": data or {},
            })

            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims=WebPushService._get_vapid_claims(),
            )
            return True

        except Exception as exc:
            exc_str = str(exc)
            # 410 Gone or 404 Not Found — endpoint is dead, caller should prune it
            if "410" in exc_str or "404" in exc_str:
                logger.info("Stale push endpoint detected, marking for removal: %s", exc_str)
                return False
            logger.error("Web push delivery failed: %s", exc_str)
            return False

    @staticmethod
    def build_subscription_info(endpoint: str, p256dh: str, auth: str) -> Dict[str, Any]:
        """Build the subscription_info dict expected by pywebpush."""
        return {
            "endpoint": endpoint,
            "keys": {
                "p256dh": p256dh,
                "auth": auth,
            },
        }
