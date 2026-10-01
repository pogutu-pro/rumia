"""Access tokens, OAuth state and refresh-token helpers for our own authentication."""
import hashlib
import secrets
import time
import uuid
from typing import Any, Dict, Optional

from jose import JWTError, jwt

from app.core.config import settings

ISSUER = "rumia"
_ALG = "HS256"


def _secret() -> str:
    if len(settings.AUTH_JWT_SECRET) < 32:
        raise RuntimeError("AUTH_JWT_SECRET must be set to at least 32 characters")
    return settings.AUTH_JWT_SECRET


def create_access_token(user_id: str, email: Optional[str], full_name: Optional[str], avatar_url: Optional[str]) -> str:
    now = int(time.time())
    claims: Dict[str, Any] = {
        "iss": ISSUER,
        "aud": "authenticated",
        "role": "authenticated",
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + settings.AUTH_ACCESS_TTL_SECONDS,
        "jti": uuid.uuid4().hex,
        "user_metadata": {"full_name": full_name, "avatar_url": avatar_url},
    }
    return jwt.encode(claims, _secret(), algorithm=_ALG)


def decode_own_access_token(token: str) -> Dict[str, Any]:
    """Verify a token signed by us (signature, expiry, issuer). Raises JWTError."""
    claims = jwt.decode(token, _secret(), algorithms=[_ALG], options={"verify_aud": False})
    if claims.get("iss") != ISSUER:
        raise JWTError("wrong issuer")
    return claims


def is_own_token(token: str) -> bool:
    """Cheap routing check: was this token minted by us (vs. Supabase)? Does not verify anything."""
    try:
        return jwt.get_unverified_claims(token).get("iss") == ISSUER
    except JWTError:
        return False


def create_signed_state(payload: Dict[str, Any], ttl_seconds: int = 600) -> str:
    now = int(time.time())
    return jwt.encode({**payload, "typ": "oauth_state", "iat": now, "exp": now + ttl_seconds}, _secret(), algorithm=_ALG)


def decode_signed_state(state: str) -> Dict[str, Any]:
    claims = jwt.decode(state, _secret(), algorithms=[_ALG], options={"verify_aud": False})
    if claims.get("typ") != "oauth_state":
        raise JWTError("not an oauth state token")
    return claims


def new_opaque_token() -> str:
    """A 256-bit random token (refresh tokens, one-time codes). Only its hash is ever stored."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
