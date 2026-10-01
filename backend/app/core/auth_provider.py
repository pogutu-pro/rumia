"""Creating/deleting login identities, behind a small interface.

Today identities live in Supabase Auth, so the implementation calls its admin API. When
authentication moves to our own Postgres (migration step 3), only `get_auth_provider()` changes
(a provider that inserts into our users table); callers stay untouched.
"""
from typing import Protocol

import httpx

from app.core.config import settings
from app.core.errors import APIException


class AuthProviderError(APIException):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(status_code=status_code, code="AUTH_PROVIDER_ERROR", message=message)


class AuthProvider(Protocol):
    async def create_user(self, email: str) -> str:
        """Create a confirmed user with a random password; return their id."""

    async def delete_user(self, user_id: str) -> None:
        """Best-effort removal (used to roll back a half-created agent)."""


class SupabaseAuthProvider:
    def __init__(self, base_url: str, service_key: str):
        self._base = base_url.rstrip("/") + "/auth/v1/admin"
        self._headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    async def create_user(self, email: str) -> str:
        import secrets

        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                f"{self._base}/users", headers=self._headers,
                json={"email": email, "password": secrets.token_urlsafe(24), "email_confirm": True},
            )
        if res.status_code >= 400:
            try:
                message = res.json().get("msg") or res.json().get("message") or res.text
            except Exception:
                message = res.text
            raise AuthProviderError(message or "Failed to create the account", status_code=400 if res.status_code < 500 else 502)
        return str(res.json()["id"])

    async def delete_user(self, user_id: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.delete(f"{self._base}/users/{user_id}", headers=self._headers)
        except Exception:
            pass


def get_auth_provider() -> AuthProvider:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise AuthProviderError("Account creation is not configured on this server", status_code=503)
    return SupabaseAuthProvider(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
