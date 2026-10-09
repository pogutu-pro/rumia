"""App-level rate limiting (slowapi) with the standard Rumia error envelope.

Limits are keyed by the requesting client IP. nginx overwrites `X-Real-IP` with the verified client
address on every request (Cloudflare's CF-Connecting-IP when the connection comes from Cloudflare, or
the address the web tier forwarded for server-side calls), so that is the only header trusted here.
`X-Forwarded-For` is deliberately ignored: a client can put anything in it.
"""

from typing import Any, Dict, Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings


def _client_ip(request: Request) -> str:
    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip
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