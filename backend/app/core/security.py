import time
from dataclasses import dataclass
from typing import Callable, List, Optional
from fastapi import Depends, Header
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db_session
from app.core.errors import ForbiddenException, UnauthorizedException


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


def decode_jwt_token(token: str) -> TokenData:
    """Decode and validate a Supabase HS256 JWT access token."""
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        raise UnauthorizedException(
            "Server authentication is not configured (SUPABASE_JWT_SECRET missing)"
        )

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_iss": False},
        )
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
                WHERE id = :user_id::uuid
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
                    WHERE id = :campus_id::uuid AND region_id = :region_id::uuid
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
