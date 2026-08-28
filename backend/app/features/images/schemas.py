from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class UploadUrlRequest(BaseModel):
    filename: str = Field(..., min_length=1)
    content_type: str = Field("image/jpeg", pattern="^image/(jpeg|jpg|png|webp)$")
    size_bytes: int = Field(..., ge=1, le=10_485_760)  # Max 10MB
    folder: str = Field("listings", description="R2 storage folder prefix (e.g. 'listings', 'profiles')")


class UploadUrlResponse(BaseModel):
    upload_url: str
    key: str
    public_url: str = ""
    expires_in: int = 3600



class ImageUploadRead(BaseModel):
    id: str
    original_filename: str
    width: int
    height: int
    file_size: int
    format: str
    thumbnail_key: str
    small_key: str
    medium_key: str
    large_key: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
