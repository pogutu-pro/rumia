import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import NotFoundException
from app.features.images.models import ImageUpload
from app.features.images.schemas import UploadUrlRequest, UploadUrlResponse


class ImageService:
    @staticmethod
    def generate_upload_url(req: UploadUrlRequest) -> UploadUrlResponse:
        ext = req.filename.split(".")[-1] if "." in req.filename else "jpg"
        key = f"listings/{uuid.uuid4()}/{req.filename}"
        public_url = getattr(settings, "R2_PUBLIC_URL", "https://pub-r2.rumia.app")
        upload_url = f"{public_url}/presigned-upload/{key}"
        return UploadUrlResponse(upload_url=upload_url, key=key, expires_in=3600)

    @staticmethod
    async def get_image_upload(db: AsyncSession, image_upload_id: str) -> ImageUpload:
        res = await db.execute(select(ImageUpload).where(ImageUpload.id == image_upload_id))
        img = res.scalar_one_or_none()
        if not img:
            raise NotFoundException(f"Image upload record '{image_upload_id}' not found")
        return img
