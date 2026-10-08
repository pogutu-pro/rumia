import uuid
from typing import Dict, List, Optional
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

    @staticmethod
    def delete_objects(keys: List[str]) -> None:
        """Delete known object keys; deleting a key that is already absent is safe."""
        unique_keys = list(dict.fromkeys(key for key in keys if key))
        if not unique_keys:
            return

        client = R2StorageService.get_s3_client()
        if client is None:
            raise RuntimeError("R2 storage is not configured; image cleanup cannot proceed")

        response = client.delete_objects(
            Bucket=settings.R2_BUCKET_NAME,
            Delete={"Objects": [{"Key": key} for key in unique_keys], "Quiet": True},
        )
        errors = response.get("Errors", [])
        if errors:
            raise RuntimeError(f"R2 failed to delete {len(errors)} image object(s)")

    # ── Direct-to-storage uploads (browser uploads straight to R2; a worker processes it) ──────────

    @staticmethod
    def _client_or_raise():
        client = R2StorageService.get_s3_client()
        if client is None:
            raise RuntimeError("R2 storage is not configured")
        return client

    @staticmethod
    def presign_put(key: str, content_type: str, expires_in: int = 900) -> str:
        client = R2StorageService._client_or_raise()
        return client.generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key, "ContentType": content_type},
            ExpiresIn=expires_in,
        )

    @staticmethod
    def head_size(key: str) -> Optional[int]:
        """Size in bytes of an uploaded object, or None if it does not exist."""
        client = R2StorageService._client_or_raise()
        try:
            return int(client.head_object(Bucket=settings.R2_BUCKET_NAME, Key=key)["ContentLength"])
        except Exception as exc:  # botocore ClientError 404
            if "404" in str(exc) or "Not Found" in str(exc) or "NoSuchKey" in str(exc):
                return None
            raise

    @staticmethod
    def get_bytes(key: str) -> bytes:
        client = R2StorageService._client_or_raise()
        return client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)["Body"].read()

    @staticmethod
    def put_bytes(key: str, data: bytes, content_type: str) -> str:
        client = R2StorageService._client_or_raise()
        client.put_object(
            Bucket=settings.R2_BUCKET_NAME, Key=key, Body=data, ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
        return f"{settings.R2_PUBLIC_URL}/{key}"
