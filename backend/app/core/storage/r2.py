import uuid
from typing import Dict, Optional
from app.core.config import settings


class R2StorageService:
    @staticmethod
    def get_s3_client():
        if not settings.R2_ACCOUNT_ID or not settings.R2_ACCESS_KEY_ID or not settings.R2_SECRET_ACCESS_KEY:
            return None

        import boto3
        from botocore.config import Config

        endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    @staticmethod
    def generate_presigned_upload_url(
        filename: str,
        content_type: str = "image/webp",
        folder: str = "listings",
        expires_in: int = 3600,
    ) -> Dict[str, str]:
        ext = filename.split(".")[-1] if "." in filename else "webp"
        unique_name = f"{uuid.uuid4()}-{filename}"
        key = f"{folder}/{unique_name}"

        client = R2StorageService.get_s3_client()
        if client:
            try:
                upload_url = client.generate_presigned_url(
                    "put_object",
                    Params={
                        "Bucket": settings.R2_BUCKET_NAME,
                        "Key": key,
                        "ContentType": content_type,
                    },
                    ExpiresIn=expires_in,
                )
                public_url = f"{settings.R2_PUBLIC_URL}/{key}"
                return {
                    "upload_url": upload_url,
                    "key": key,
                    "public_url": public_url,
                    "expires_in": str(expires_in),
                }
            except Exception:
                pass

        # Fallback for dev / mock modes
        mock_upload_url = f"{settings.R2_PUBLIC_URL}/presigned-upload/{key}"
        mock_public_url = f"{settings.R2_PUBLIC_URL}/{key}"
        return {
            "upload_url": mock_upload_url,
            "key": key,
            "public_url": mock_public_url,
            "expires_in": str(expires_in),
        }
