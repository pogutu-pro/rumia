import uuid

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.core.permissions import AccessContext, get_access
from app.core.ratelimit import limiter
from app.core.storage.r2 import R2StorageService
from app.core.tasks.jobs import enqueue
from app.features.media.processing import MAX_BYTES

router = APIRouter(prefix="/media", tags=["Media"])

ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class UploadRequest(BaseModel):
    org_id: str
    filename: str = Field(..., max_length=200)
    content_type: str
    size: int = Field(..., gt=0)


class UploadTicket(BaseModel):
    asset_id: str
    upload_url: str
    method: str = "PUT"
    headers: dict


class AttachRequest(BaseModel):
    asset_id: str
    room_tag: str = "other"
    position: int = 0
    is_cover: bool = False


@router.post("/uploads", response_model=UploadTicket, status_code=status.HTTP_201_CREATED, summary="Start A Photo Upload",
             description="Returns a short-lived URL to PUT the file straight to storage. Call /media/{id}/complete afterwards. "
                         "Requires permission to add properties for the organisation.")
@limiter.limit("60/minute")
async def start_upload(request: Request, body: UploadRequest, access: AccessContext = Depends(get_access),
                       db: AsyncSession = Depends(get_db_session, scope="function")) -> UploadTicket:
    if not (access.can("property.create", org_id=body.org_id) or access.can_staff_anywhere("property.create")):
        raise ForbiddenException("You cannot add photos for this organisation.")
    ext = ALLOWED_TYPES.get(body.content_type)
    if not ext:
        raise BadRequestException("Only JPEG, PNG or WebP photos can be uploaded.")
    if body.size > MAX_BYTES:
        raise BadRequestException("Photos can be at most 15 MB.")
    asset_id = str(uuid.uuid4())
    key = f"raw/{asset_id}/original.{ext}"
    await db.execute(
        text(
            """
            INSERT INTO media_assets (id, org_id, kind, source, status, storage_key, created_by)
            VALUES (CAST(:i AS uuid), CAST(:o AS uuid), 'image', 'upload', 'pending', :k, CAST(:u AS uuid))
            """
        ),
        {"i": asset_id, "o": body.org_id, "k": key, "u": access.user_id},
    )
    return UploadTicket(asset_id=asset_id, upload_url=R2StorageService.presign_put(key, body.content_type),
                        headers={"Content-Type": body.content_type})


@router.post("/{asset_id}/complete", status_code=status.HTTP_202_ACCEPTED, summary="Finish A Photo Upload",
             description="Confirms the file arrived and queues processing (resizing, blur placeholder, duplicate hash).")
async def complete_upload(asset_id: str, access: AccessContext = Depends(get_access),
                          db: AsyncSession = Depends(get_db_session, scope="function")) -> dict:
    row = (
        await db.execute(
            text("SELECT storage_key, status, created_by FROM media_assets WHERE id = CAST(:a AS uuid)"), {"a": asset_id}
        )
    ).first()
    if not row or str(row[2]) != access.user_id:
        raise NotFoundException("Upload not found.")
    if row[1] != "pending":
        return {"status": row[1]}
    size = R2StorageService.head_size(row[0])
    if size is None:
        raise ConflictException(code="UPLOAD_MISSING", message="The file has not arrived yet. Upload it, then try again.")
    if size > MAX_BYTES:
        raise BadRequestException("Photos can be at most 15 MB.")
    await db.execute(text("UPDATE media_assets SET status = 'processing' WHERE id = CAST(:a AS uuid)"), {"a": asset_id})
    await enqueue(db, "process_media_asset", {"asset_id": asset_id}, idempotency_key=f"media:{asset_id}")
    return {"status": "processing"}


@router.get("/{asset_id}", summary="Upload Status", description="Whether a photo is still processing, ready, or was rejected (with why).")
async def asset_status(asset_id: str, access: AccessContext = Depends(get_access),
                       db: AsyncSession = Depends(get_db_session, scope="function")) -> dict:
    row = (
        await db.execute(
            text("SELECT status, url, error, blur_data_url, created_by FROM media_assets WHERE id = CAST(:a AS uuid)"), {"a": asset_id}
        )
    ).first()
    if not row or str(row[4]) != access.user_id:
        raise NotFoundException("Upload not found.")
    return {"status": row[0], "url": row[1], "error": row[2], "blur_data_url": row[3]}
