"""App-level rate limiting (slowapi) with the standard Rumia error envelope.

Limits are keyed by the requesting client IP. Behind nginx the real client IP
is carried in `X-Forwarded-For`, which nginx sets from `$proxy_add_x_forwarded_for`.
"""

from typing import Any, Dict, Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# `default_limits` apply to every route that does not declare a specific limit.
limiter = Limiter(
    key_func=_client_ip,
    default_limits=[settings.RATE_LIMIT_DEFAULT] if settings.RATE_LIMIT_ENABLED else [],
    enabled=settings.RATE_LIMIT_ENABLED,
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    retry_after: Optional[int] = None
    limit_item = getattr(getattr(exc, "limit", None), "limit", None)
    if limit_item is not None:
        try:
            retry_after = limit_item.get_expiry()
        except Exception:
            retry_after = None
    headers: Dict[str, str] = {}
    if retry_after:
        headers["Retry-After"] = str(retry_after)
    body: Dict[str, Any] = {
        "error": {
            "code": "RATE_LIMITED",
            "message": "Too many requests. Please try again later.",
        }
    }
    return JSONResponse(status_code=429, content=body, headers=headers)