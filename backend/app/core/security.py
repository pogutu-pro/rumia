import base64
import json
import logging
import time
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional
from fastapi import Depends, Header
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import ec, rsa

from app.core.config import settings
from app.core.database import get_db_session
from app.core.errors import ForbiddenException, UnauthorizedException

logger = logging.getLogger(__name__)


@dataclass
class TokenData:
    user_id: str
    email: Optional[str] = None
    role: str = "authenticated"
    exp: Optional[int] = None
    iss: Optional[str] = None


@dataclass
class AuthenticatedUser:
    id: str
    email: Optional[str] = None
    role: str = "student"
    managed_campus_id: Optional[str] = None
    managed_region_id: Optional[str] = None
    is_active: bool = True

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_manager(self) -> bool:
        return self.role in ("manager", "admin")

    @property
    def is_agent(self) -> bool:
        return self.role in ("agent", "admin")


_JWKS_TTL_SECONDS = 3600.0
_JWKS_URL_SUFFIX = "/auth/v1/.well-known/jwks.json"
_JWKS_KEYS: Dict[str, Dict[str, Any]] = {}
_JWKS_FETCHED_AT = 0.0
_EC_CURVES = {
    "P-256": ec.SECP256R1,
    "P-384": ec.SECP384R1,
    "P-521": ec.SECP521R1,
}


def _base64url_to_int(value: str) -> int:
    padded = value + "=" * (-len(value) % 4)
    return int.from_bytes(base64.urlsafe_b64decode(padded), "big")


def _jwk_to_public_key(jwk_data: Dict[str, Any]):
    try:
        kty = jwk_data.get("kty")
        if kty == "EC":
            curve = _EC_CURVES.get(jwk_data.get("crv", ""))
            if curve is None:
                raise JWTError(f"Unsupported JWK EC curve: {jwk_data.get('crv')}")
            public_key = ec.EllipticCurvePublicNumbers(
                _base64url_to_int(jwk_data["x"]),
                _base64url_to_int(jwk_data["y"]),
                curve(),
            ).public_key(default_backend())
        elif kty == "RSA":
            public_key = rsa.RSAPublicNumbers(
                _base64url_to_int(jwk_data["e"]),
                _base64url_to_int(jwk_data["n"]),
            ).public_key(default_backend())
        else:
            raise JWTError(f"Unsupported JWK key type: {kty}")
    except JWTError:
        raise
    except Exception as exc:
        raise JWTError(f"Invalid JWK payload: {exc}") from exc

    logger.debug("Resolved Supabase JWT public key (kid=%s, kty=%s)", jwk_data.get("kid"), kty)
    return public_key


def _fetch_jwks() -> None:
    global _JWKS_FETCHED_AT, _JWKS_KEYS
    now = time.time()
    if _JWKS_KEYS and now - _JWKS_FETCHED_AT < _JWKS_TTL_SECONDS:
        return

    if not settings.SUPABASE_URL:
        raise UnauthorizedException("Server authentication is not configured (SUPABASE_URL missing)")

    try:
        request = urllib.request.Request(
            f"{settings.SUPABASE_URL.rstrip('/')}{_JWKS_URL_SUFFIX}",
            headers={"apikey": settings.SUPABASE_ANON_KEY},
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            jwks = json.load(response)
        fetched = {
            key["kid"]: key
            for key in jwks.get("keys", [])
            if key.get("kid")
        }
        if not fetched:
            raise JWTError("JWKS contained no usable signing keys")
        _JWKS_KEYS = fetched
        _JWKS_FETCHED_AT = time.time()
    except Exception as exc:
        _JWKS_FETCHED_AT = 0.0
        raise UnauthorizedException(f"Unable to retrieve JWT signing keys: {exc}") from exc


def _decode_payload(token: str, key: Any, algorithms: List[str]) -> dict:
    return jwt.decode(
        token,
        key,
        algorithms=algorithms,
        options={"verify_aud": False, "verify_iss": False},
    )


def decode_jwt_token(token: str) -> TokenData:
    """Decode and validate a Supabase JWT access token.

    Supabase signs access tokens with the algorithm selected per project
    (ES256 by default). The legacy HS256 path (project JWT "secret") is kept
    as a fallback; ES256/RS256 tokens are verified against the project's
    public signing keys, fetched from GoTrue's JWKS endpoint and cached.
    """
    try:
        header = jwt.get_unverified_headers(token)
        algorithm = header.get("alg", "HS256")

        if algorithm == "HS256":
            secret = settings.SUPABASE_JWT_SECRET
            if not secret:
                raise UnauthorizedException(
                    "Server authentication is not configured (SUPABASE_JWT_SECRET missing)"
                )
            payload = _decode_payload(token, secret, ["HS256"])
        else:
            _fetch_jwks()
            kid = header.get("kid", "")
            jwk_data = _JWKS_KEYS.get(kid)
            if jwk_data is None:
                raise UnauthorizedException(f"Unknown JWT signing key id: {kid}")
            public_key = _jwk_to_public_key(jwk_data)
            payload = _decode_payload(token, public_key, [algorithm])

        user_id: str = payload.get("sub")
        if not user_id:
            raise UnauthorizedException("Invalid token claims: missing sub")

        exp = payload.get("exp")
        if exp and exp < time.time():
            raise UnauthorizedException("Token has expired")

        return TokenData(
            user_id=user_id,
            email=payload.get("email"),
            role=payload.get("role", "authenticated"),
            exp=exp,
            iss=payload.get("iss"),
        )
    except JWTError as e:
        raise UnauthorizedException(f"Invalid authentication token: {str(e)}")


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise UnauthorizedException("Invalid Authorization header format. Expected 'Bearer <token>'")
    return parts[1]


async def _resolve_authenticated_user(
    db: AsyncSession,
    token_data: TokenData,
) -> AuthenticatedUser:
    # Query DB profiles for canonical user role & campus/region scope
    try:
        result = await db.execute(
            text("""
                SELECT id, email, role, managed_campus_id, managed_region_id
                FROM public.profiles
                WHERE id = CAST(:user_id AS uuid)
            """),
            {"user_id": token_data.user_id},
        )
        row = result.fetchone()
        if row:
            return AuthenticatedUser(
                id=str(row.id),
                email=row.email or token_data.email,
                role=row.role or "student",
                managed_campus_id=str(row.managed_campus_id) if row.managed_campus_id else None,
                managed_region_id=str(row.managed_region_id) if row.managed_region_id else None,
            )
    except Exception:
        # DB query failed or table not seeded; fallback to token payload for safety
        pass

    return AuthenticatedUser(
        id=token_data.user_id,
        email=token_data.email,
        role="student",
    )


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session),
) -> AuthenticatedUser:
    """FastAPI Dependency: Extract Bearer JWT and return verified AuthenticatedUser."""
    token = _extract_bearer_token(authorization)
    if not token:
        raise UnauthorizedException("Authorization header missing")

    token_data = decode_jwt_token(token)
    return await _resolve_authenticated_user(db, token_data)


async def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session),
) -> Optional[AuthenticatedUser]:
    """Resolve an authenticated user when a bearer token is present; allow anonymous reads."""
    token = _extract_bearer_token(authorization)
    if not token:
        return None

    token_data = decode_jwt_token(token)
    return await _resolve_authenticated_user(db, token_data)


def require_roles(*allowed_roles: str) -> Callable:
    """Dependency factory enforcing allowed user roles."""
    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in allowed_roles and not user.is_admin:
            raise ForbiddenException(
                f"Role '{user.role}' is not authorized to access this resource. Allowed roles: {list(allowed_roles)}"
            )
        return user

    return role_checker


async def check_campus_scope(
    user: AuthenticatedUser,
    campus_id: str,
    db: AsyncSession,
) -> bool:
    """Verify if user has administrative scope over the given campus_id."""
    if user.is_admin:
        return True

    if user.role != "manager":
        return False

    if user.managed_campus_id == campus_id:
        return True

    if user.managed_region_id:
        try:
            result = await db.execute(
                text("""
                    SELECT 1 FROM public.campuses
                    WHERE id = CAST(:campus_id AS uuid) AND region_id = CAST(:region_id AS uuid)
                """),
                {"campus_id": campus_id, "region_id": user.managed_region_id},
            )
            if result.fetchone():
                return True
        except Exception:
            pass

    return False


def check_ownership(user: AuthenticatedUser, owner_id: str) -> bool:
    """Verify if user owns a resource or is admin."""
    if user.is_admin:
        return True
    if user.id == owner_id:
        return True
    raise ForbiddenException("You do not own this resource")
