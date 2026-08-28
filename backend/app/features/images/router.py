from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import AuthenticatedUser, get_current_user
from app.features.images.schemas import ImageUploadRead, UploadUrlRequest, UploadUrlResponse
from app.features.images.service import ImageService

router = APIRouter(prefix="/images", tags=["Image Uploads"])


@router.post(
    "/upload-url",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Presigned Upload URL",
    description="Generate a direct presigned R2 upload URL for listing image. Authenticated.",
)
async def get_upload_url(
    req: UploadUrlRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> UploadUrlResponse:
    return ImageService.generate_upload_url(req)


@router.get(
    "/{image_upload_id}",
    response_model=ImageUploadRead,
    status_code=status.HTTP_200_OK,
    summary="Get Image Metadata",
    description="Fetch processed image metadata. Authenticated.",
)
async def get_image_upload(
    image_upload_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ImageUploadRead:
    img = await ImageService.get_image_upload(db, image_upload_id)
    return ImageUploadRead.model_validate(img)
