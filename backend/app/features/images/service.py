from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundException
from app.core.storage.r2 import R2StorageService
from app.features.images.models import ImageUpload
from app.features.images.schemas import UploadUrlRequest, UploadUrlResponse


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
    async def get_image_upload(db: AsyncSession, image_upload_id: str) -> ImageUpload:
        res = await db.execute(select(ImageUpload).where(ImageUpload.id == image_upload_id))
        img = res.scalar_one_or_none()
        if not img:
            raise NotFoundException(f"Image upload record '{image_upload_id}' not found")
        return img
