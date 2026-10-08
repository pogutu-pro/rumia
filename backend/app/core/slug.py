import re
import unicodedata
from typing import Awaitable, Callable, Optional


def slugify(text: str) -> str:
    """lowercase, drop punctuation, spaces -> '-' (same rules as the web's `slugify`)."""
    value = re.sub(r"[^a-z0-9\s-]", "", (text or "").lower().strip())
    value = re.sub(r"\s+", "-", value)
    return re.sub(r"-+", "-", value)


async def unique_slug(base: str, is_taken: Callable[[str], Awaitable[bool]]) -> str:
    """base, base-2, base-3 … the first one not already taken."""
    candidate, n = base, 2
    while await is_taken(candidate):
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def url_segment(value: Optional[str]) -> str:
    """'Near Gate A' -> 'near-gate-a' (matches web/src/lib/utils/listing-path.ts)."""
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def listing_path(county: Optional[str], area: Optional[str], slug: str) -> str:
    """Canonical public path of a property."""
    from app.core.config import settings

    return f"/hostels/{url_segment(county) or settings.DEFAULT_COUNTY}/{url_segment(area) or settings.DEFAULT_CAMPUS_SLUG}/{slug}"
