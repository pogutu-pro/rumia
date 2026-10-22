"""Give legacy listing photos the same resized variants new uploads get.

Photos uploaded before the variant pipeline are single full-size files (some over 3 MB) that every card, on every
phone, downloads in full: the image loader can only pick a smaller size when the URL ends in a variant name
(`.../card.webp`). This re-encodes each legacy photo with the worker's own `process_image_bytes` (thumb, card,
gallery, large WebP; EXIF dropped), points `listing_images` at the `card` variant like a new upload, and re-runs
`project_listing()` so the property copy (`media_assets`) follows.

Safe to re-run: only rows still on a legacy URL are touched, and a row is only updated if its URL is unchanged since
it was read. Originals are never deleted. Every change is printed as `old -> new` so it can be reversed.

Usage (inside the backend container):
  python scripts/backfill_legacy_photos.py            # dry run: list what would change
  python scripts/backfill_legacy_photos.py --apply --limit 1   # one photo first
  python scripts/backfill_legacy_photos.py --apply    # do it
"""
import argparse
import asyncio
import sys

from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.storage.r2 import R2StorageService
from app.features.media.processing import InvalidImage, process_image_bytes

VARIANT_URL = r"/(thumb|card|gallery|large|original)\.(webp|jpg|jpeg|png)$"


async def main(apply: bool, limit: int | None) -> int:
    base = settings.R2_PUBLIC_URL.rstrip("/")
    if not base:
        print("R2_PUBLIC_URL is not set", file=sys.stderr)
        return 1
    async with async_session_factory() as db:
        rows = (
            await db.execute(
                text(
                    """SELECT id::text, listing_id::text, r2_url FROM listing_images
                       WHERE r2_url !~ :variant AND starts_with(r2_url, :base)
                       ORDER BY created_at LIMIT :n"""
                ),
                {"variant": VARIANT_URL, "base": base + "/", "n": limit},
            )
        ).all()
    print(f"{len(rows)} legacy photo(s) on {base}")
    if not apply:
        for image_id, _, url in rows:
            print(f"would convert {image_id} {url}")
        return 0

    listings: set[str] = set()
    done = skipped = failed = 0
    saved_bytes = 0
    for image_id, listing_id, url in rows:
        key = url[len(base) + 1:]
        try:
            raw = await asyncio.to_thread(R2StorageService.get_bytes, key)
            processed = await asyncio.to_thread(process_image_bytes, raw)
        except InvalidImage as exc:
            skipped += 1
            print(f"skip {image_id} {url}: {exc}")
            continue
        except Exception as exc:  # network or storage: leave the row as it is
            failed += 1
            print(f"fail {image_id} {url}: {exc!r}")
            continue

        urls = {}
        for name, blob in processed.variants.items():
            urls[name] = await asyncio.to_thread(
                R2StorageService.put_bytes, f"media/legacy-{image_id}/{name}.webp", blob, "image/webp"
            )
        async with async_session_factory() as db:
            result = await db.execute(
                text(
                    """UPDATE listing_images SET r2_url = :new, blur_data_url = :blur, width = :w, height = :h,
                              format = 'webp'
                       WHERE id = CAST(:id AS uuid) AND r2_url = :old"""
                ),
                {"id": image_id, "old": url, "new": urls["card"], "blur": processed.blur_data_url,
                 "w": processed.width, "h": processed.height},
            )
            await db.commit()
        if result.rowcount != 1:
            skipped += 1
            print(f"skip {image_id}: changed while converting")
            continue
        done += 1
        listings.add(listing_id)
        saved_bytes += len(raw) - len(processed.variants["card"])
        print(f"done {image_id} {url} -> {urls['card']} ({len(raw) // 1024}KB -> card {len(processed.variants['card']) // 1024}KB)")

    # Carry the new URLs, sizes and blur placeholders into the property copy, the same path a listing save takes.
    for listing_id in sorted(listings):
        async with async_session_factory() as db:
            await db.execute(text("SELECT project_listing(CAST(:l AS uuid))"), {"l": listing_id})
            await db.commit()

    print(
        f"converted {done}, skipped {skipped}, failed {failed}; {len(listings)} listing(s) re-projected; "
        f"card downloads {saved_bytes // 1024}KB lighter in total"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="convert and update (default is a dry run)")
    parser.add_argument("--limit", type=int, default=None, help="convert at most this many photos")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.apply, args.limit)))
