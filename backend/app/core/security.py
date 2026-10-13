import logging
from dataclasses import dataclass
from typing import Callable, Optional
from fastapi import Depends, Header
from jose import JWTError

from app.core.tokens import decode_own_access_token, is_own_token
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db_session
from app.core.errors import ForbiddenException, ServiceUnavailableException, UnauthorizedException

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


def decode_jwt_token(token: str) -> TokenData:
    """Verify an access token minted by our own auth service (signature, expiry, issuer).

    Anything not signed by us is rejected."""
    try:
        if not is_own_token(token):
            raise UnauthorizedException("Invalid authentication token")
        payload = decode_own_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedException("Invalid token claims: missing sub")
        return TokenData(
            user_id=user_id, email=payload.get("email"), role=payload.get("role", "authenticated"),
            exp=payload.get("exp"), iss=payload.get("iss"),
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
    # The profile row is the source of truth for role and campus/region scope. If it cannot be read we
    # must not guess: answering as a plain "student" would silently downgrade staff and hide the outage.
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
    except Exception as exc:
        logger.error("Could not resolve user profile for authorization: %s", exc)
        raise ServiceUnavailableException("We could not verify your account right now. Please try again.") from exc

    if row:
        return AuthenticatedUser(
            id=str(row.id),
            email=row.email or token_data.email,
            role=row.role or "student",
            managed_campus_id=str(row.managed_campus_id) if row.managed_campus_id else None,
            managed_region_id=str(row.managed_region_id) if row.managed_region_id else None,
        )

    # A valid token for a user with no profile row yet (first request after sign-in): least privilege.
    return AuthenticatedUser(
        id=token_data.user_id,
        email=token_data.email,
        role="student",
    )


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> AuthenticatedUser:
    """FastAPI Dependency: Extract Bearer JWT and return verified AuthenticatedUser."""
    token = _extract_bearer_token(authorization)
    if not token:
        raise UnauthorizedException("Authorization header missing")

    token_data = decode_jwt_token(token)
    return await _resolve_authenticated_user(db, token_data)


async def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session, scope="function"),
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
