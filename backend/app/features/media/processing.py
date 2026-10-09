"""Image processing for direct uploads: resized WebP variants, a blur placeholder and a perceptual hash.

Runs in the worker (never in the web process). EXIF, including GPS, is dropped because every variant is
re-encoded from pixels.
"""
import base64
import io
import logging
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.storage.r2 import R2StorageService
from app.core.tasks.jobs import enqueue, register

logger = logging.getLogger(__name__)

Image.MAX_IMAGE_PIXELS = 60_000_000  # reject decompression bombs
MIN_SIDE = 400
MAX_BYTES = 15 * 1024 * 1024

# name -> (width, height or None for "keep aspect ratio", quality)
VARIANTS: Dict[str, Tuple[int, Optional[int], int]] = {
    "thumb": (400, 300, 75),
    "card": (800, 600, 80),
    "gallery": (1200, None, 82),
    "large": (1600, None, 80),
}


class InvalidImage(Exception):
    """The file cannot be used as a listing photo (not an image, too small, too large)."""


@dataclass
class ProcessedImage:
    variants: Dict[str, bytes]
    sizes: Dict[str, Tuple[int, int]]
    width: int
    height: int
    blur_data_url: str
    content_hash: str


def dhash(img: Image.Image, size: int = 8) -> str:
    """64-bit difference hash as hex. Near-identical photos give near-identical hashes."""
    small = img.convert("L").resize((size + 1, size), Image.Resampling.LANCZOS)
    px = list(small.tobytes())
    bits = 0
    for row in range(size):
        for col in range(size):
            bits = (bits << 1) | (1 if px[row * (size + 1) + col] > px[row * (size + 1) + col + 1] else 0)
    return f"{bits:016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def _encode(img: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=4)
    return buf.getvalue()


def process_image_bytes(data: bytes) -> ProcessedImage:
    if len(data) > MAX_BYTES:
        raise InvalidImage("The photo is larger than 15 MB.")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImage("This file is not a usable image.") from exc
    img = ImageOps.exif_transpose(img).convert("RGB")
    if min(img.size) < MIN_SIDE:
        raise InvalidImage(f"The photo is too small (at least {MIN_SIDE}px on the short side).")

    variants: Dict[str, bytes] = {}
    sizes: Dict[str, Tuple[int, int]] = {}
    for name, (w, h, quality) in VARIANTS.items():
        if h is not None:
            out = ImageOps.fit(img, (w, h), Image.Resampling.LANCZOS)  # crop to the card ratio
        elif img.width > w:
            out = img.resize((w, round(img.height * w / img.width)), Image.Resampling.LANCZOS)
        else:
            out = img.copy()  # never upscale
        variants[name] = _encode(out, quality)
        sizes[name] = out.size

    blur = img.copy()
    blur.thumbnail((16, 16))
    blur_url = "data:image/webp;base64," + base64.b64encode(_encode(blur, 40)).decode()
    return ProcessedImage(variants, sizes, img.width, img.height, blur_url, dhash(img))


@register("process_media_asset")
async def process_media_asset(payload: dict) -> None:
    asset_id = payload["asset_id"]
    async with async_session_factory() as db:
        row = (
            await db.execute(
                text("SELECT storage_key, status FROM media_assets WHERE id = CAST(:a AS uuid)"), {"a": asset_id}
            )
        ).first()
        if not row or row[1] == "ready":
            return
        storage_key = row[0]
        await db.execute(text("UPDATE media_assets SET status = 'processing' WHERE id = CAST(:a AS uuid)"), {"a": asset_id})
        await db.commit()

    raw = R2StorageService.get_bytes(storage_key)  # transient errors propagate and the job is retried
    try:
        processed = process_image_bytes(raw)
    except InvalidImage as exc:
        async with async_session_factory() as db:
            await db.execute(
                text("UPDATE media_assets SET status = 'rejected', error = :e WHERE id = CAST(:a AS uuid)"),
                {"a": asset_id, "e": str(exc)},
            )
            await db.commit()
        return

    urls: Dict[str, str] = {}
    for name, blob in processed.variants.items():
        urls[name] = R2StorageService.put_bytes(f"media/{asset_id}/{name}.webp", blob, "image/webp")

    import json

    async with async_session_factory() as db:
        await db.execute(
            text(
                """
                UPDATE media_assets SET status = 'ready', url = :url, variants = CAST(:v AS jsonb), width = :w, height = :h,
                       blur_data_url = :blur, content_hash = :hash, error = NULL
                WHERE id = CAST(:a AS uuid)
                """
            ),
            {"a": asset_id, "url": urls["gallery"], "v": json.dumps(urls), "w": processed.width, "h": processed.height,
             "blur": processed.blur_data_url, "hash": processed.content_hash},
        )
        await db.commit()


# ── Photos uploaded through the original form ────────────────────────────────────────────────────
# Those are resized and stored by the web app, so they arrive as ready media assets without the
# duplicate-photo fingerprint the review queue relies on. This adds it, after the fact and out of band.

def hash_image_bytes(data: bytes) -> str:
    """The same fingerprint `process_image_bytes` stores, for an image that is already processed."""
    if len(data) > MAX_BYTES:
        raise InvalidImage("The photo is larger than 15 MB.")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImage("This file is not a usable image.") from exc
    return dhash(ImageOps.exif_transpose(img).convert("RGB"))


def is_own_storage_url(url: Optional[str]) -> bool:
    """Only our own photo storage is ever fetched. Listing image URLs come from listers, so anything
    else (an internal address, another site) must never be requested by the server."""
    base = (settings.R2_PUBLIC_URL or "").rstrip("/")
    return bool(url and base and url.startswith(base + "/"))


async def enqueue_missing_hashes(db, listing_id: Optional[str] = None, limit: int = 200) -> int:
    """Queue a fingerprint job for ready photos that have none. Safe to call repeatedly."""
    rows = (
        await db.execute(
            text(
                """
                SELECT m.id::text FROM media_assets m
                WHERE m.kind = 'image' AND m.status = 'ready' AND m.content_hash IS NULL AND m.url IS NOT NULL
                  AND m.legacy_image_id IS NOT NULL
                  AND (CAST(:l AS uuid) IS NULL OR m.legacy_image_id IN (SELECT id FROM listing_images WHERE listing_id = CAST(:l AS uuid)))
                ORDER BY m.created_at DESC LIMIT :n
                """
            ),
            {"l": str(listing_id) if listing_id else None, "n": limit},
        )
    ).all()
    queued = 0
    for (asset_id,) in rows:
        if await enqueue(db, "hash_legacy_media", {"asset_id": asset_id}, idempotency_key=f"hash:{asset_id}"):
            queued += 1
    return queued


@register("hash_legacy_media")
async def hash_legacy_media(payload: dict) -> None:
    asset_id = payload["asset_id"]
    async with async_session_factory() as db:
        row = (await db.execute(text("SELECT url, content_hash FROM media_assets WHERE id = CAST(:a AS uuid)"), {"a": asset_id})).first()
    if not row or row[1] or not is_own_storage_url(row[0]):
        return  # gone, already done, or not ours to fetch
    async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
        resp = await client.get(row[0])
    if resp.status_code >= 500:
        resp.raise_for_status()  # transient: let the queue retry
    if resp.status_code != 200:
        return
    try:
        digest = hash_image_bytes(resp.content)
    except InvalidImage:
        return  # not decodable: leave it unhashed rather than retry forever
    async with async_session_factory() as db:
        await db.execute(
            text("UPDATE media_assets SET content_hash = :h WHERE id = CAST(:a AS uuid) AND content_hash IS NULL"),
            {"a": asset_id, "h": digest},
        )
        await db.commit()
