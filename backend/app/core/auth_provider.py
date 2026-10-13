"""Creating/deleting login identities, behind a small interface. Identities live in our own `auth.users` table."""
from typing import Protocol

from app.core.errors import APIException


class AuthProviderError(APIException):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(status_code=status_code, code="AUTH_PROVIDER_ERROR", message=message)


class AuthProvider(Protocol):
    async def create_user(self, email: str) -> str:
        """Create a confirmed user with a random password; return their id."""

    async def delete_user(self, user_id: str) -> None:
        """Best-effort removal (used to roll back a half-created agent)."""


class LocalAuthProvider:
    """Identities live in our own `auth.users` table. Runs in the caller's
    transaction, so a failed agent creation rolls the identity back with everything else."""

    def __init__(self, db):
        self._db = db

    async def create_user(self, email: str) -> str:
        from sqlalchemy import text

        email = email.strip().lower()
        existing = (await self._db.execute(text("SELECT 1 FROM auth.users WHERE email = :e"), {"e": email})).first()
        if existing:
            raise AuthProviderError("An account with this email already exists", status_code=400)
        row = (
            await self._db.execute(
                text("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), :e) RETURNING id"), {"e": email}
            )
        ).first()
        return str(row[0])

    async def delete_user(self, user_id: str) -> None:
        pass  # rolled back with the surrounding transaction


def get_auth_provider(db=None) -> AuthProvider:
    if db is None:
        raise AuthProviderError("Account creation is not configured on this server", status_code=503)
    return LocalAuthProvider(db)
