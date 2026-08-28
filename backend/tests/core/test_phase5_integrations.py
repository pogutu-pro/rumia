"""Phase 5 tests — Cloudflare R2 storage, WhatsApp builder, and PostHog dispatcher."""
import pytest
from unittest.mock import patch, MagicMock


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
