"""Phase 5 tests — Cloudflare R2 storage, WhatsApp builder, and PostHog dispatcher."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ── R2 Storage ───────────────────────────────────────────────────────────────

class TestR2StorageService:
    def test_generate_presigned_url_mock_mode(self):
        """Without R2 credentials, returns a predictable mock URL."""
        from app.core.storage.r2 import R2StorageService

        result = R2StorageService.generate_presigned_upload_url(
            filename="room.jpg",
            content_type="image/jpeg",
            folder="listings",
        )

        assert "upload_url" in result
        assert "key" in result
        assert "public_url" in result
        assert result["key"].startswith("listings/")
        assert "room.jpg" in result["key"]

    def test_key_contains_uuid(self):
        """Each generated key should be unique (contains uuid4)."""
        from app.core.storage.r2 import R2StorageService

        r1 = R2StorageService.generate_presigned_upload_url("a.jpg", folder="listings")
        r2 = R2StorageService.generate_presigned_upload_url("a.jpg", folder="listings")
        assert r1["key"] != r2["key"], "Keys must be unique across requests"

    def test_profile_folder(self):
        """Profile uploads use a different folder prefix."""
        from app.core.storage.r2 import R2StorageService

        result = R2StorageService.generate_presigned_upload_url(
            "avatar.png", folder="profiles"
        )
        assert result["key"].startswith("profiles/")

    def test_presigned_url_with_real_credentials(self):
        """
        When R2 credentials are configured, boto3 should be invoked.
        We mock boto3.client to avoid real network calls.
        """
        import boto3
        from app.core.storage.r2 import R2StorageService
        from app.core.config import settings

        original_account = settings.R2_ACCOUNT_ID
        original_key = settings.R2_ACCESS_KEY_ID
        original_secret = settings.R2_SECRET_ACCESS_KEY

        settings.R2_ACCOUNT_ID = "fake_account"
        settings.R2_ACCESS_KEY_ID = "fake_key_id"
        settings.R2_SECRET_ACCESS_KEY = "fake_secret"

        try:
            mock_client = MagicMock()
            mock_client.generate_presigned_url.return_value = "https://fake-r2.com/presigned"

            with patch("boto3.client", return_value=mock_client):
                result = R2StorageService.generate_presigned_upload_url(
                    "photo.jpg", folder="listings"
                )

            assert result["upload_url"] == "https://fake-r2.com/presigned"
            assert result["key"].startswith("listings/")
        finally:
            settings.R2_ACCOUNT_ID = original_account
            settings.R2_ACCESS_KEY_ID = original_key
            settings.R2_SECRET_ACCESS_KEY = original_secret


# ── WhatsApp Integration ─────────────────────────────────────────────────────

class TestWhatsAppBuilder:
    def test_basic_inquiry_url(self):
        from app.core.integrations.whatsapp import build_whatsapp_inquiry_url

        url = build_whatsapp_inquiry_url(
            agent_whatsapp="+254712345678",
            listing_title="Studio near UoN",
            listing_location="Ngara",
            price=8000,
        )
        assert url.startswith("https://wa.me/254712345678")
        assert "text=" in url
        assert "Studio%20near%20UoN" in url or "Studio" in url

    def test_full_listing_shows_unavailable(self):
        from app.core.integrations.whatsapp import build_whatsapp_inquiry_url

        url = build_whatsapp_inquiry_url(
            agent_whatsapp="0712345678",
            listing_title="Double Room",
            listing_location="Westlands",
            price=12000,
            is_full=True,
        )
        assert "Currently%20Full" in url or "Full" in url

    def test_consultation_fee_included(self):
        from app.core.integrations.whatsapp import build_whatsapp_inquiry_url

        url = build_whatsapp_inquiry_url(
            agent_whatsapp="254712000000",
            listing_title="Bedsitter",
            listing_location="Karen",
            price=15000,
            consultation_fee=500,
        )
        assert "500" in url

    def test_phone_number_cleaned(self):
        from app.core.integrations.whatsapp import build_whatsapp_inquiry_url

        url = build_whatsapp_inquiry_url(
            agent_whatsapp="+254 712-345-678",
            listing_title="Room",
            listing_location="CBD",
            price=None,
        )
        # Cleaned phone should appear without spaces/dashes/+
        assert "https://wa.me/254712345678" in url


# ── Expo Push Integration ────────────────────────────────────────────────────

class _MockExpoResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _MockExpoClient:
    def __init__(self, calls, payload):
        self.calls = calls
        self.payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, url, json, headers):
        self.calls.append({"url": url, "json": json, "headers": headers})
        return _MockExpoResponse(self.payload)


class TestExpoPushService:
    def test_token_detection(self):
        from app.core.integrations.expo_push import ExpoPushService

        assert ExpoPushService.is_expo_push_token("ExpoPushToken[abc]")
        assert ExpoPushService.is_expo_push_token("ExponentPushToken[abc]")
        assert not ExpoPushService.is_expo_push_token("native-fcm-token")

    async def test_send_push_delivered(self):
        from app.core.integrations.expo_push import ExpoPushService

        calls = []
        with patch(
            "httpx.AsyncClient",
            side_effect=lambda *args, **kwargs: _MockExpoClient(
                calls,
                {"data": {"status": "ok", "id": "ticket-1"}},
            ),
        ):
            status = await ExpoPushService.send_push(
                token="ExpoPushToken[abc]",
                title="Hello",
                body="World",
                data={"url": "/notifications"},
            )

        assert status == "delivered"
        assert calls[0]["url"] == ExpoPushService.SEND_URL
        assert calls[0]["json"]["to"] == "ExpoPushToken[abc]"

    async def test_send_push_marks_unregistered_devices_stale(self):
        from app.core.integrations.expo_push import ExpoPushService

        calls = []
        with patch(
            "httpx.AsyncClient",
            side_effect=lambda *args, **kwargs: _MockExpoClient(
                calls,
                {
                    "data": {
                        "status": "error",
                        "details": {"error": "DeviceNotRegistered"},
                    },
                },
            ),
        ):
            status = await ExpoPushService.send_push(
                token="ExponentPushToken[abc]",
                title="Hello",
                body="World",
            )

        assert status == "stale"

    async def test_send_push_skips_non_expo_tokens(self):
        from app.core.integrations.expo_push import ExpoPushService

        with patch("httpx.AsyncClient") as client_mock:
            status = await ExpoPushService.send_push(
                token="native-fcm-token",
                title="Hello",
                body="World",
            )

        assert status == "skipped"
        client_mock.assert_not_called()


# ── Background Push Worker ───────────────────────────────────────────────────

class _MockFetchAllResult:
    def __init__(self, rows):
        self.rows = rows

    def fetchall(self):
        return self.rows


class _MockWorkerSession:
    def __init__(self, results=None):
        self.results = list(results or [])
        self.executions = []
        self.commit = AsyncMock(return_value=None)

    async def execute(self, stmt, params=None):
        self.executions.append({"stmt": str(stmt), "params": params or {}})
        if self.results and "SELECT" in str(stmt):
            return self.results.pop(0)
        return _MockFetchAllResult([])


class _MockSessionContext:
    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return None


class _MockSessionFactory:
    def __init__(self, sessions):
        self.sessions = list(sessions)

    def __call__(self):
        return _MockSessionContext(self.sessions.pop(0))


class TestPushWorker:
    async def test_dispatches_to_web_and_mobile_tokens_and_deactivates_stale(self):
        from types import SimpleNamespace

        from app.core.tasks.worker import send_push_to_user

        web_row = SimpleNamespace(id="web-1", endpoint="https://push.example", p256dh="p", auth="a")
        device_row = SimpleNamespace(id="device-1", token="ExpoPushToken[abc]")
        read_session = _MockWorkerSession(
            results=[
                _MockFetchAllResult([web_row]),
                _MockFetchAllResult([device_row]),
            ]
        )
        write_session = _MockWorkerSession()
        session_factory = _MockSessionFactory([read_session, write_session])

        with (
            patch("app.core.database.async_session_factory", session_factory),
            patch(
                "app.core.integrations.webpush.WebPushService.send_push_status",
                return_value="stale",
            ) as web_push_mock,
            patch(
                "app.core.integrations.expo_push.ExpoPushService.send_push",
                new=AsyncMock(return_value="stale"),
            ) as expo_push_mock,
        ):
            await send_push_to_user(
                user_id="student-1",
                title="New message",
                message="You have an update",
                data={"url": "/notifications"},
            )

        assert len(read_session.executions) == 5
        insert_stmt = str(read_session.executions[0]["stmt"])
        assert "INSERT INTO app_notifications" in insert_stmt
        assert read_session.executions[0]["params"] == {
            "user_id": "student-1",
            "title": "New message",
            "message": "You have an update",
            "url": "/notifications",
            "type": "info",
        }
        # push_deliveries queue rows recorded for each token (dedup by idempotency_key)
        queue_stmts = [str(e["stmt"]) for e in read_session.executions]
        assert sum("INSERT INTO push_deliveries" in s for s in queue_stmts) == 2
        queue_params = [e["params"] for e in read_session.executions if "push_deliveries" in str(e["stmt"])]
        assert {p["token_id"] for p in queue_params} == {"web-1", "device-1"}
        assert all(p["key"].startswith("push:") for p in queue_params)
        web_push_mock.assert_called_once()
        expo_push_mock.assert_awaited_once()
        # Single write session: status updates + stale-token pruning, one commit.
        write_stmts = [str(e["stmt"]) for e in write_session.executions]
        status_keys = [
            e["params"]["key"]
            for e in write_session.executions
            if "UPDATE push_deliveries" in str(e["stmt"])
        ]
        assert len(status_keys) == 2
        assert status_keys[0].startswith("push:web:web-1")
        assert status_keys[1].startswith("push:expo:device-1")
        assert sum("UPDATE push_subscriptions" in s for s in write_stmts) == 1
        assert sum("UPDATE device_tokens" in s for s in write_stmts) == 1
        write_session.commit.assert_awaited_once()

    async def test_in_app_notification_uses_data_type_and_prunes_when_no_channels(self):
        from app.core.tasks.worker import send_push_to_user

        read_session = _MockWorkerSession()
        write_session = _MockWorkerSession()
        session_factory = _MockSessionFactory([read_session, write_session])

        with (
            patch("app.core.database.async_session_factory", session_factory),
            patch(
                "app.core.integrations.webpush.WebPushService.send_push_status",
                return_value="stale",
            ),
            patch(
                "app.core.integrations.expo_push.ExpoPushService.send_push",
                new=AsyncMock(return_value="stale"),
            ) as expo_push_mock,
        ):
            await send_push_to_user(
                user_id="student-2",
                title="New review",
                message="Someone reviewed your hostel",
                data={"type": "review", "listing_id": "listing-9"},
            )

        assert read_session.executions[0]["params"]["type"] == "review"
        assert len(read_session.executions) == 3
        expo_push_mock.assert_not_awaited()


# ── PostHog Integration ──────────────────────────────────────────────────────

class TestPostHogDispatcher:
    def test_capture_skipped_when_no_token(self):
        """No errors when PostHog token is not configured."""
        from app.core.integrations import posthog as ph
        from app.core.config import settings

        original = settings.POSTHOG_PROJECT_TOKEN
        settings.POSTHOG_PROJECT_TOKEN = ""
        ph._client = None  # Reset singleton

        try:
            # Should not raise even without a token
            ph.capture("user_123", "test_event", {"key": "value"})
        finally:
            settings.POSTHOG_PROJECT_TOKEN = original
            ph._client = None

    def test_track_lead_created_fires(self):
        from app.core.integrations import posthog as ph

        with patch.object(ph, "capture") as mock_cap:
            ph.track_lead_created("u1", "l1", "a1")
            mock_cap.assert_called_once_with("u1", "lead_created", {
                "listing_id": "l1",
                "agent_id": "a1",
            })

    def test_track_tour_booked_fires(self):
        from app.core.integrations import posthog as ph

        with patch.object(ph, "capture") as mock_cap:
            ph.track_tour_booked("u2", "l2", "2026-09-01")
            mock_cap.assert_called_once_with("u2", "tour_booked", {
                "listing_id": "l2",
                "tour_date": "2026-09-01",
            })

    def test_track_review_submitted_fires(self):
        from app.core.integrations import posthog as ph

        with patch.object(ph, "capture") as mock_cap:
            ph.track_review_submitted("u3", "l3", 4)
            mock_cap.assert_called_once_with("u3", "review_submitted", {
                "listing_id": "l3",
                "rating": 4,
            })


# ── Images API endpoint ───────────────────────────────────────────────────────

class TestImagesUploadUrl:
    async def test_upload_url_returns_key_and_url(self, authed_client):
        resp = await authed_client.post("/api/v1/images/upload-url", json={
            "filename": "room1.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 204800,
            "folder": "listings",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "upload_url" in data
        assert "key" in data
        assert data["key"].startswith("listings/")

    async def test_upload_url_too_large(self, authed_client):
        resp = await authed_client.post("/api/v1/images/upload-url", json={
            "filename": "huge.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 999_000_000,  # 999MB — exceeds 10MB limit
        })
        assert resp.status_code == 422
