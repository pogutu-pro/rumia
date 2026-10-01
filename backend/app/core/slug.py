import re
from typing import Awaitable, Callable


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
