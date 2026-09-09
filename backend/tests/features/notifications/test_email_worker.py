"""Unit tests for EmailDeliveryWorker.send_one provider-rejection handling."""
import uuid
from datetime import datetime
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest


class _Email:
    def __init__(self, user_id: str):
        self.id = str(uuid.uuid4())
        self.user_id = user_id
        self.listing_id = None
        self.notification_type = "wishlist_listing_updated"
        self.to_email = "paul@example.com"
        self.subject = "Price updated on a wishlisted hostel"
        self.template_name = "wishlist_listing_updated"
        self.status = "pending"
        self.provider_message_id: Optional[str] = None
        self.error_message: Optional[str] = None
        self.retry_count = 0
        self.payload = {"summary": "updated"}
        self.sent_at: Optional[datetime] = None


class _Result:
    def __init__(self, single=None, mappings_first=None):
        self._single = single
        self._first = mappings_first
        self.rowcount = 1
        self.text = ""

    def scalar_one_or_none(self):
        return self._single

    def mappings(self):
        m = MagicMock()
        m.first.return_value = self._first
        m.all.return_value = self._first if self._first is not None else []
        return m


class _FakeSession:
    """Minimal stand-in for the async DB session inside send_one.

    Mirrors async_sessionmaker: calling the factory returns the session
    directly (no await), and `async with session` uses __aenter__.
    """

    def __init__(self, delivery: _Email, user: Optional[dict], listing: Optional[dict]):
        self.delivery = delivery
        self.user = user
        self.listing = listing
        self.commits = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, stmt, *args, **kwargs):
        if self.listing is None:
            return _Result(single=self.delivery, mappings_first=self.user)
        if args or getattr(stmt, "text", "").startswith("select id, title"):
            return _Result(mappings_first=self.listing)
        return _Result(single=self.delivery, mappings_first=self.user)

    async def commit(self):
        self.commits += 1


class _EmailService:
    provider_name = "brevo"

    def __init__(self, send_result, status_result=None):
        self._send_result = send_result
        self._status_result = status_result

    async def send(self, **kwargs):
        return self._send_result

    async def check_status(self, message_id):
        return self._status_result


@pytest.mark.asyncio
async def test_send_one_marks_failed_when_provider_rejects_async():
    """Brevo accepts with 201 but later reports an error -> delivery failed."""
    delivery = _Email("user-1")
    session = _FakeSession(
        delivery, user={"id": "user-1", "email": "paul@example.com", "full_name": None}, listing=None
    )
    svc = _EmailService(
        send_result=MagicMock(success=True, provider_message_id="<abc@smtp-relay.mailin.fr>"),
        status_result=("error", "sender contact@rumia.co.ke is not valid"),
    )

    with patch("app.features.notifications.email_worker.async_session_factory", side_effect=lambda: session), patch(
        "app.features.notifications.email_worker.email_service", new=svc
    ):
        from app.features.notifications.email_worker import EmailDeliveryWorker

        await EmailDeliveryWorker.send_one("dummy-id")

    assert delivery.status == "failed"
    assert "not valid" in delivery.error_message
    assert session.commits > 0


@pytest.mark.asyncio
async def test_send_one_marks_delivered_when_provider_confirms():
    delivery = _Email("user-1")
    session = _FakeSession(
        delivery, user={"id": "user-1", "email": "paul@example.com", "full_name": None}, listing=None
    )
    svc = _EmailService(
        send_result=MagicMock(success=True, provider_message_id="<abc@smtp-relay.mailin.fr>"),
        status_result=("delivered", None),
    )

    with patch("app.features.notifications.email_worker.async_session_factory", side_effect=lambda: session), patch(
        "app.features.notifications.email_worker.email_service", new=svc
    ):
        from app.features.notifications.email_worker import EmailDeliveryWorker

        await EmailDeliveryWorker.send_one("dummy-id")

    assert delivery.status == "delivered"
    assert delivery.error_message is None


@pytest.mark.asyncio
async def test_send_one_keeps_sent_when_status_unknown():
    delivery = _Email("user-1")
    session = _FakeSession(
        delivery, user={"id": "user-1", "email": "paul@example.com", "full_name": None}, listing=None
    )
    svc = _EmailService(
        send_result=MagicMock(success=True, provider_message_id="<abc@smtp-relay.mailin.fr>"),
        status_result=None,  # status check unavailable -> keep "sent"
    )

    with patch("app.features.notifications.email_worker.async_session_factory", side_effect=lambda: session), patch(
        "app.features.notifications.email_worker.email_service", new=svc
    ):
        from app.features.notifications.email_worker import EmailDeliveryWorker

        await EmailDeliveryWorker.send_one("dummy-id")

    assert delivery.status == "sent"
    assert delivery.sent_at is not None