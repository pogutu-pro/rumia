import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.security import AuthenticatedUser
from app.core.storage.r2 import R2StorageService
from app.features.bnb.models import BnbDetails
from app.features.bnb.schemas import BnbListingCreate
from app.features.bnb.router import _to_read
from app.features.bnb.service import BnbService
from app.features.images.models import ImageUpload
from app.features.images.service import ImageService
from app.features.listings.models import Listing
from app.features.listings.models import ListingImage
from app.features.listings.service import ListingService
from tests.conftest import MockResult, _make_mock_listing


def _upload(upload_id: str = "image-upload-id") -> SimpleNamespace:
    base = "owner-id/room_abc123"
    return SimpleNamespace(
        id=upload_id,
        thumbnail_key=f"{base}/thumb.webp",
        small_key=f"{base}/card.webp",
        medium_key=f"{base}/gallery.webp",
        large_key=f"{base}/large.webp",
        format="image/webp",
    )


@pytest.mark.asyncio
async def test_bnb_deletion_cleans_uploads_before_existing_listing_delete(monkeypatch):
    listing = _make_mock_listing(
        id="bnb-listing-id",
        property_type="short_stay",
        agent_user_id="owner-user-id",
    )
    events = []
    cleanup = AsyncMock(side_effect=lambda *_: events.append("cleanup"))
    db = MagicMock()
    db.delete = AsyncMock(side_effect=lambda *_: events.append("delete"))
    db.flush = AsyncMock()
    monkeypatch.setattr(ListingService, "get_listing_by_id_or_slug", AsyncMock(return_value=listing))
    monkeypatch.setattr(ImageService, "cleanup_listing_uploads", cleanup)

    await ListingService.delete_listing(
        db=db,
        listing_id=listing.id,
        user=AuthenticatedUser(id="admin-user-id", role="admin"),
    )

    cleanup.assert_awaited_once_with(db, listing.id)
    assert events == ["cleanup", "delete"]
    db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_cleanup_deletes_only_unshared_metadata_and_all_pipeline_objects(monkeypatch):
    owned_upload = _upload()
    shared_upload_id = "shared-upload-id"
    missing_upload_id = "missing-upload-id"
    db = MagicMock()
    db.execute = AsyncMock(
        side_effect=[
            MockResult(items=[owned_upload.id, shared_upload_id, missing_upload_id]),
            MockResult(single=owned_upload),
            MockResult(scalar_value=0),
            MockResult(single=None),
            MockResult(single=SimpleNamespace(
                id=shared_upload_id,
                thumbnail_key="owner-id/shared/thumb.webp",
                small_key="owner-id/shared/card.webp",
                medium_key="owner-id/shared/gallery.webp",
                large_key="owner-id/shared/large.webp",
                format="image/webp",
            )),
            MockResult(scalar_value=1),
        ]
    )
    db.delete = AsyncMock()
    db.flush = AsyncMock()
    deleted_keys = []

    def record_deleted_objects(keys):
        deleted_keys.append(keys)

    monkeypatch.setattr(
        R2StorageService, "delete_objects", staticmethod(record_deleted_objects)
    )

    async def run_storage_inline(function, *args):
        return function(*args)

    monkeypatch.setattr(asyncio, "to_thread", run_storage_inline)

    await ImageService.cleanup_listing_uploads(db, "bnb-listing-id")

    expected_keys = [
        owned_upload.thumbnail_key,
        owned_upload.small_key,
        owned_upload.medium_key,
        owned_upload.large_key,
        "owner-id/room_abc123/original.webp",
        "owner-id/room_abc123/blur.webp",
    ]
    assert deleted_keys == [expected_keys]
    db.delete.assert_awaited_once_with(owned_upload)
    db.flush.assert_awaited_once()


def test_r2_delete_treats_missing_objects_as_success(monkeypatch):
    class FakeR2Client:
        def __init__(self):
            self.request = None

        def delete_objects(self, **kwargs):
            self.request = kwargs
            # S3-compatible DeleteObjects reports absent keys as deleted.
            return {"Deleted": kwargs["Delete"]["Objects"]}

    client = FakeR2Client()
    monkeypatch.setattr(R2StorageService, "get_s3_client", staticmethod(lambda: client))

    R2StorageService.delete_objects(["already-absent.webp", "already-absent.webp"])

    assert client.request["Delete"]["Objects"] == [{"Key": "already-absent.webp"}]


@pytest.mark.asyncio
async def test_non_bnb_listing_deletion_keeps_existing_path_without_image_cleanup(monkeypatch):
    listing = _make_mock_listing(
        id="hostel-listing-id",
        property_type="hostel",
        agent_user_id="owner-user-id",
    )
    db = MagicMock()
    db.delete = AsyncMock()
    db.flush = AsyncMock()
    cleanup = AsyncMock()
    monkeypatch.setattr(ListingService, "get_listing_by_id_or_slug", AsyncMock(return_value=listing))
    monkeypatch.setattr(ImageService, "cleanup_listing_uploads", cleanup)

    await ListingService.delete_listing(
        db=db,
        listing_id=listing.id,
        user=AuthenticatedUser(id="admin-user-id", role="admin"),
    )

    cleanup.assert_not_awaited()
    db.delete.assert_awaited_once_with(listing)
    db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_bnb_service_preserves_upload_id_when_creating_listing_images(monkeypatch):
    listing_id = "00000000-0000-0000-0000-000000000052"
    image_upload_id = "00000000-0000-0000-0000-000000000051"
    monkeypatch.setattr(
        ListingService,
        "resolve_agent_for_user",
        AsyncMock(return_value=SimpleNamespace(
            id="owner-agent-id", campus_id=None, whatsapp="+254700000000"
        )),
    )
    monkeypatch.setattr(ListingService, "_auto_verify_listing", AsyncMock())
    monkeypatch.setattr(
        BnbService,
        "_upsert_bnb_details",
        AsyncMock(return_value=BnbDetails(listing_id=listing_id)),
    )
    db = MagicMock()
    db.add = MagicMock()
    db.execute = AsyncMock(return_value=MockResult())
    db.flush = AsyncMock()
    monkeypatch.setattr(
        ListingService,
        "get_listing_by_id_or_slug",
        AsyncMock(side_effect=lambda _db, _listing_id: next(
            value for value in db.add.call_args_list
            if isinstance(value.args[0], Listing)
        ).args[0]),
    )

    await BnbService.create_bnb_listing(
        db=db,
        user=AuthenticatedUser(id="owner-user-id", role="agent"),
        data=BnbListingCreate(
            title="Quiet BnB",
            description="A quiet short stay near town.",
            price=4000,
            location="Nyeri",
            images=[
                {"r2_url": "https://cdn.example.test/card.webp", "image_upload_id": image_upload_id}
            ],
        ),
    )

    image_row = next(
        call.args[0]
        for call in db.add.call_args_list
        if isinstance(call.args[0], ListingImage)
    )
    assert image_row.image_upload_id == image_upload_id


def test_bnb_response_preserves_upload_id_for_existing_image():
    listing = _make_mock_listing(
        id="00000000-0000-0000-0000-000000000053",
        property_type="short_stay",
    )
    listing.agent.slug = None
    image = MagicMock(spec=ListingImage)
    image.id = "listing-image-id"
    image.image_upload_id = "00000000-0000-0000-0000-000000000054"
    image.r2_url = "https://cdn.example.test/card.webp"
    image.display_order = 0
    image.category = "Room"
    image.blur_data_url = None
    image.width = 800
    image.height = 600
    image.format = "webp"
    listing.images = [image]

    response = _to_read(listing, None)

    assert response.images[0]["image_upload_id"] == image.image_upload_id
