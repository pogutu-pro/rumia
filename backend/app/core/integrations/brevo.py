"""Brevo transactional email provider (v3 API).

Implements the `EmailProvider` protocol. Uses the official brevo SDK when
available at runtime; falls back to a clean httpx integration otherwise so the
core notification code never depends on a specific library.
"""
import logging
from typing import List

from app.core.config import settings
from app.core.email.provider import (
    EmailAddress,
    EmailEvent,
    SendEmailCommand,
    SendEmailResult,
)

logger = logging.getLogger(__name__)

SEND_ENDPOINT = "https://api.brevo.com/v3/smtp/email"
EVENTS_ENDPOINT = "https://api.brevo.com/v3/smtp/statistics/events"

# Delivery states reported by Brevo that mean the message was NOT accepted
# for delivery after the initial "201 Created" acknowledgement.
REJECTED_STATUSES = {"blocked", "bounced", "invalid_email", "error", "failed", "spam"}


class BrevoProvider:
    """Brevo is the default EmailProvider implementation for Rumia."""

    name = "brevo"

    def __init__(self) -> None:
        self._api_key = settings.BREVO_API_KEY
        self._sender = EmailAddress(email=settings.BREVO_SENDER_EMAIL, name=settings.BREVO_SENDER_NAME)

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def send(self, command: SendEmailCommand) -> SendEmailResult:
        if not self.is_configured:
            return SendEmailResult(
                success=False,
                error_message="BREVO_API_KEY is not configured",
            )

        payload = {
            "sender": self._sender.as_brevo_format(),
            "to": [command.to.as_brevo_format()],
            "subject": command.subject,
            "htmlContent": command.html_content,
        }
        if command.text_content:
            payload["textContent"] = command.text_content
        if command.tags:
            payload["tags"] = command.tags
        if command.reply_to:
            payload["replyTo"] = command.reply_to.as_brevo_format()

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": self._api_key,
        }

        # Prefer the official SDK when installed (cleaner error handling).
        try:
            from brevo.api.smtp_api import SmtpApi  # type: ignore
            from brevo_client.brevo.rest import ApiException as BrevoApiException  # type: ignore
            from brevo_client.brevo.models.send_smtp_email import SendSmtpEmail  # type: ignore

            sdk = SmtpApi.__new__(SmtpApi)
            sdk.api_client = None  # The SDK's configuration is wired via environment normally.
        except Exception:
            sdk = None

        if sdk is not None:
            return await self._send_via_sdk(payload, command.to.email)
        return await self._send_via_http(payload, headers, command.to.email)

    async def _send_via_http(self, payload: dict, headers: dict, to_email: str) -> SendEmailResult:
        import httpx

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(SEND_ENDPOINT, json=payload, headers=headers)
                if resp.status_code >= 400:
                    logger.warning(
                        "Brevo send failed (HTTP %s) for %s: %s",
                        resp.status_code,
                        to_email,
                        resp.text[:500],
                    )
                    return SendEmailResult(success=False, error_message=resp.text[:500])
                data = resp.json()
                message_id = data.get("messageId") or data.get("message_id")
                return SendEmailResult(success=True, provider_message_id=message_id)
        except Exception as exc:
            logger.warning("Brevo send raised for %s: %s", to_email, exc)
            return SendEmailResult(success=False, error_message=str(exc))

    async def _send_via_sdk(self, payload: dict, to_email: str) -> SendEmailResult:
        try:
            from brevo.api.smtp_api import SmtpApi  # type: ignore
            from brevo_client.brevo.models.send_smtp_email import SendSmtpEmail  # type: ignore

            configured_api = SmtpApi()
            send_email = SendSmtpEmail(**payload)
            resp = await configured_api.send_transac_email(  # type: ignore[attr-defined]
                send_transac_email=send_email
            )
            message_id = getattr(resp, "message_id", None) or getattr(resp, "messageId", None)
            return SendEmailResult(success=True, provider_message_id=str(message_id) if message_id else None)
        except Exception as exc:
            logger.warning("Brevo SDK send failed for %s: %s", to_email, exc)
            try:
                return await self._send_via_http(
                    payload,
                    {"Accept": "application/json", "Content-Type": "application/json", "api-key": self._api_key},
                    to_email,
                )
            except Exception:
                return SendEmailResult(success=False, error_message=str(exc))

    async def check_status(self, message_id: str):
        """Look up the latest delivery event for a message on Brevo's side.

        Brevo acknowledges sends with HTTP 201 but can reject the message
        asynchronously (e.g. "sender is not valid"). Returns (status,
        reason) or None when the status cannot be determined.
        """
        from urllib.parse import quote

        import httpx

        url = f"{EVENTS_ENDPOINT}?messageId={quote(str(message_id))}&limit=10"
        headers = {"Accept": "application/json", "api-key": self._api_key}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    return None
                events = resp.json().get("events") or []
                if not events:
                    return None
                # Events are unordered; use the newest timestamp.
                latest = max(events, key=lambda e: e.get("date") or "")
                return str(latest.get("event", "")).lower(), latest.get("reason")
        except Exception as exc:
            logger.warning("Brevo status check failed for %s: %s", message_id, exc)
            return None

    def parse_webhook(self, payload: dict) -> List[EmailEvent]:
        events: List[EmailEvent] = []
        items = payload.get("items")
        if not isinstance(items, list):
            return events

        for item in items:
            message_id = item.get("message-id") or item.get("messageId") or item.get("id")
            if not message_id:
                continue
            events.append(
                EmailEvent(
                    provider_message_id=str(message_id),
                    event=item.get("event", "").lower(),
                    timestamp=item.get("date"),
                    reason=item.get("reason"),
                )
            )
        return events