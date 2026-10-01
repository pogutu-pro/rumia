import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import PurePosixPath

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, NotFoundException
from app.core.security import AuthenticatedUser
from app.core.storage.r2 import R2StorageService
from app.features.images.models import ImageUpload
from app.features.images.schemas import ImageUploadCreate, UploadUrlRequest, UploadUrlResponse
from app.features.listings.models import ListingImage


class ImageService:
    @staticmethod
    def generate_upload_url(req: UploadUrlRequest) -> UploadUrlResponse:
        """
        Generate a Cloudflare R2 presigned PUT URL for direct client-to-R2 upload.
        Falls back to a mock URL in dev if R2 credentials are not configured.
        """
        folder = req.folder if hasattr(req, "folder") and req.folder else "listings"
        result = R2StorageService.generate_presigned_upload_url(
            filename=req.filename,
            content_type=req.content_type if hasattr(req, "content_type") and req.content_type else "image/webp",
            folder=folder,
            expires_in=3600,
        )
        return UploadUrlResponse(
            upload_url=result["upload_url"],
            key=result["key"],
            public_url=result["public_url"],
            expires_in=int(result["expires_in"]),
        )

    @staticmethod
    async def register_upload(db: AsyncSession, user: AuthenticatedUser, data: ImageUploadCreate) -> ImageUpload:
        """Record metadata for an image processed into R2 by the web pipeline.

        Cleanup later deletes the R2 objects named here, so every key must follow the
        pipeline's layout and live under the caller's own `<user_id>/` prefix; otherwise a
        user could point a row at someone else's files and have them deleted.
        """
        expected = {
            "thumbnail_key": "thumb.webp",
            "small_key": "card.webp",
            "medium_key": "gallery.webp",
            "large_key": "large.webp",
        }
        base_paths = set()
        for field, filename in expected.items():
            key = PurePosixPath(getattr(data, field))
            if key.name != filename:
                raise BadRequestException(f"{field} must end with {filename}")
            base_paths.add(key.parent.as_posix())
        if len(base_paths) != 1:
            raise BadRequestException("Image variants must share one base path")
        base_path = base_paths.pop()
        parts = PurePosixPath(base_path).parts
        if len(parts) != 2 or ".." in parts or (parts[0] != user.id and not user.is_admin):
            raise BadRequestException("Image keys must be under your own user prefix")

        upload = ImageUpload(id=str(uuid.uuid4()), created_at=datetime.now(timezone.utc), **data.model_dump())
        db.add(upload)
        await db.flush()
        return upload

    @staticmethod
    async def get_image_upload(db: AsyncSession, image_upload_id: str) -> ImageUpload:
        res = await db.execute(select(ImageUpload).where(ImageUpload.id == image_upload_id))
        img = res.scalar_one_or_none()
        if not img:
            raise NotFoundException(f"Image upload record '{image_upload_id}' not found")
        return img

    @staticmethod
    async def cleanup_listing_uploads(db: AsyncSession, listing_id: str) -> None:
        """Delete upload metadata and R2 variants exclusively referenced by a listing."""
        image_result = await db.execute(
            select(ListingImage.image_upload_id).where(
                ListingImage.listing_id == listing_id,
                ListingImage.image_upload_id.is_not(None),
            )
        )
        image_upload_ids = {row for row in image_result.scalars().all() if row}

        for image_upload_id in sorted(image_upload_ids):
            upload_result = await db.execute(
                select(ImageUpload)
                .where(ImageUpload.id == image_upload_id)
                .with_for_update()
            )
            image_upload = upload_result.scalar_one_or_none()
            if image_upload is None:
                continue

            other_references = await db.execute(
                select(func.count())
                .select_from(ListingImage)
                .where(
                    ListingImage.image_upload_id == image_upload_id,
                    ListingImage.listing_id != listing_id,
                )
            )
            if other_references.scalar_one() > 0:
                continue

            keys = ImageService._listing_image_object_keys(image_upload)
            await asyncio.to_thread(R2StorageService.delete_objects, keys)
            await db.delete(image_upload)

        await db.flush()

    @staticmethod
    def _listing_image_object_keys(image_upload: ImageUpload) -> list[str]:
        variant_keys = [
            image_upload.thumbnail_key,
            image_upload.small_key,
            image_upload.medium_key,
            image_upload.large_key,
        ]
        base_paths = {PurePosixPath(key).parent.as_posix() for key in variant_keys}
        expected_names = {"thumb.webp", "card.webp", "gallery.webp", "large.webp"}
        if (
            len(base_paths) != 1
            or {PurePosixPath(key).name for key in variant_keys} != expected_names
        ):
            raise ValueError("Image upload metadata does not match the listing image pipeline")

        base_path = base_paths.pop()
        if base_path in {"", "."}:
            raise ValueError("Image upload metadata is missing its R2 base path")

        extension = {
            "image/jpeg": "jpg",
            "image/webp": "webp",
            "image/avif": "avif",
        }.get(image_upload.format, "png")
        return [
            *variant_keys,
            f"{base_path}/original.{extension}",
            f"{base_path}/blur.webp",
        ]
