import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import APIException, BadRequestException, UnauthorizedException
from app.core.security import AuthenticatedUser
from app.core.tokens import (
    create_access_token,
    create_signed_state,
    decode_signed_state,
    hash_token,
    new_opaque_token,
)
from app.features.auth.schemas import SessionTokens
from app.features.profiles.service import ProfileService

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
OTC_TTL_SECONDS = 120


class AuthDisabled(APIException):
    def __init__(self):
        super().__init__(status_code=404, code="AUTH_DISABLED", message="Not found")


def ensure_enabled() -> None:
    if settings.AUTH_MODE != "custom":
        raise AuthDisabled()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def safe_next(value: Optional[str]) -> Optional[str]:
    """Only same-site relative paths ('/x'), never '//host' or schemes."""
    if value and value.startswith("/") and not value.startswith("//") and "\\" not in value:
        return value
    return None


def safe_app_redirect(value: Optional[str]) -> Optional[str]:
    if value and any(value.startswith(p) for p in settings.AUTH_ALLOWED_APP_REDIRECTS):
        return value
    return None


class AuthService:
    # ---- Google --------------------------------------------------------------------------
    @staticmethod
    def build_google_url(next_path: Optional[str], app_redirect: Optional[str]) -> tuple[str, str]:
        nonce = secrets.token_urlsafe(16)
        state = create_signed_state(
            {"nonce": nonce, "next": safe_next(next_path), "app": safe_app_redirect(app_redirect), "csrf": secrets.token_urlsafe(8)}
        )
        query = urlencode(
            {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "nonce": nonce,
                "prompt": "select_account",
            }
        )
        return f"{GOOGLE_AUTH_URL}?{query}", state

    @staticmethod
    async def _verify_google_code(code: str, nonce: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            if res.status_code != 200:
                raise UnauthorizedException("Google rejected the sign-in code")
            id_token = res.json().get("id_token")
            if not id_token:
                raise UnauthorizedException("Google returned no identity token")
            jwks = (await client.get(GOOGLE_CERTS_URL)).json()
        try:
            claims = jwt.decode(
                id_token, jwks, algorithms=["RS256"], audience=settings.GOOGLE_CLIENT_ID,
                options={"verify_at_hash": False},
            )
        except JWTError:
            raise UnauthorizedException("Invalid Google identity token")
        if claims.get("iss") not in GOOGLE_ISSUERS:
            raise UnauthorizedException("Invalid Google issuer")
        if claims.get("nonce") != nonce:
            raise UnauthorizedException("Sign-in nonce mismatch")
        if not claims.get("email") or not claims.get("email_verified"):
            raise UnauthorizedException("Google account email is not verified")
        return claims

    @staticmethod
    async def google_callback(db: AsyncSession, code: str, state: str) -> SessionTokens:
        try:
            st = decode_signed_state(state)
        except JWTError:
            raise BadRequestException("Invalid or expired sign-in state")
        claims = await AuthService._verify_google_code(code, st["nonce"])
        user_id = await AuthService._upsert_user(
            db, claims["email"], claims.get("name"), claims.get("picture"), claims.get("sub")
        )
        tokens = await AuthService._login(db, user_id, claims["email"], claims.get("name"), claims.get("picture"))
        tokens.next = st.get("next")
        if st.get("app"):
            tokens.app_redirect = st["app"]
            tokens.otc = await AuthService._issue_otc(db, user_id)
        return tokens

    # ---- Users ---------------------------------------------------------------------------
    @staticmethod
    async def _upsert_user(db: AsyncSession, email: str, name: Optional[str], picture: Optional[str], google_sub: Optional[str]) -> str:
        """Find by (case-insensitive) email so migrated users keep their original UUID."""
        email = email.strip().lower()
        meta = json.dumps({k: v for k, v in {"full_name": name, "avatar_url": picture, "provider_id": google_sub}.items() if v})
        row = (
            await db.execute(
                text(
                    """
                    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, last_sign_in_at)
                    VALUES (gen_random_uuid(), :email, CAST(:meta AS jsonb), now(), now(), now())
                    ON CONFLICT (email) DO UPDATE
                      SET last_sign_in_at = now(), updated_at = now(),
                          raw_user_meta_data = COALESCE(auth.users.raw_user_meta_data, '{}'::jsonb) || CAST(:meta AS jsonb)
                    RETURNING id
                    """
                ),
                {"email": email, "meta": meta},
            )
        ).first()
        return str(row[0])

    @staticmethod
    async def _login(db: AsyncSession, user_id: str, email: str, name: Optional[str], picture: Optional[str]) -> SessionTokens:
        email = email.strip().lower()
        # Profile row + role come from our tables; same bookkeeping the old callback did.
        auth_user = AuthenticatedUser(id=user_id, email=email, role="student")
        profile, _ = await ProfileService.sync_login(db, auth_user, name, picture)
        refresh, _fid = await AuthService._issue_refresh(db, user_id, uuid.uuid4())
        return SessionTokens(
            access_token=create_access_token(user_id, email, profile.full_name, profile.avatar_url),
            refresh_token=refresh,
            expires_in=settings.AUTH_ACCESS_TTL_SECONDS,
            user_id=user_id,
        )

    # ---- Refresh tokens ------------------------------------------------------------------
    @staticmethod
    async def _issue_refresh(db: AsyncSession, user_id: str, family_id: uuid.UUID, kind: str = "refresh", ttl: Optional[timedelta] = None) -> tuple[str, str]:
        token = new_opaque_token()
        ttl = ttl or timedelta(days=settings.AUTH_REFRESH_TTL_DAYS)
        await db.execute(
            text(
                """INSERT INTO public.auth_refresh_tokens (user_id, token_hash, family_id, kind, expires_at)
                   VALUES (CAST(:u AS uuid), :h, CAST(:f AS uuid), :k, :exp)"""
            ),
            {"u": user_id, "h": hash_token(token), "f": str(family_id), "k": kind, "exp": _now() + ttl},
        )
        return token, str(family_id)

    @staticmethod
    async def _issue_otc(db: AsyncSession, user_id: str) -> str:
        token, _ = await AuthService._issue_refresh(db, user_id, uuid.uuid4(), "otc", timedelta(seconds=OTC_TTL_SECONDS))
        return token

    @staticmethod
    async def _consume(db: AsyncSession, token: str, kind: str):
        """Atomically mark a token used. A replayed (already used) token revokes its whole family."""
        row = (
            await db.execute(
                text(
                    """SELECT id, user_id, family_id, expires_at, used_at, revoked_at
                       FROM public.auth_refresh_tokens WHERE token_hash = :h AND kind = :k FOR UPDATE"""
                ),
                {"h": hash_token(token), "k": kind},
            )
        ).first()
        if row is None:
            raise UnauthorizedException("Invalid token")
        if row.revoked_at is not None or row.expires_at < _now():
            raise UnauthorizedException("Token expired")
        if row.used_at is not None:
            await db.execute(
                text("UPDATE public.auth_refresh_tokens SET revoked_at = now() WHERE family_id = :f AND revoked_at IS NULL"),
                {"f": row.family_id},
            )
            # Persist the revocation even though we are about to reject the request.
            await db.commit()
            raise UnauthorizedException("Token reuse detected; please sign in again")
        await db.execute(text("UPDATE public.auth_refresh_tokens SET used_at = now() WHERE id = :i"), {"i": row.id})
        return row

    @staticmethod
    async def _session_for(db: AsyncSession, user_id: str, family_id) -> SessionTokens:
        user = (
            await db.execute(
                text(
                    """SELECT u.email, p.full_name, p.avatar_url FROM auth.users u
                       LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = CAST(:u AS uuid)"""
                ),
                {"u": str(user_id)},
            )
        ).first()
        if user is None:
            raise UnauthorizedException("Account no longer exists")
        refresh, _ = await AuthService._issue_refresh(db, str(user_id), uuid.UUID(str(family_id)))
        return SessionTokens(
            access_token=create_access_token(str(user_id), user.email, user.full_name, user.avatar_url),
            refresh_token=refresh,
            expires_in=settings.AUTH_ACCESS_TTL_SECONDS,
            user_id=str(user_id),
        )

    @staticmethod
    async def refresh(db: AsyncSession, refresh_token: str) -> SessionTokens:
        row = await AuthService._consume(db, refresh_token, "refresh")
        return await AuthService._session_for(db, row.user_id, row.family_id)

    @staticmethod
    async def exchange_otc(db: AsyncSession, code: str) -> SessionTokens:
        row = await AuthService._consume(db, code, "otc")
        # New family for the app's own session.
        return await AuthService._session_for(db, row.user_id, uuid.uuid4())

    @staticmethod
    async def logout(db: AsyncSession, refresh_token: str) -> None:
        await db.execute(
            text(
                """UPDATE public.auth_refresh_tokens SET revoked_at = now()
                   WHERE family_id = (SELECT family_id FROM public.auth_refresh_tokens WHERE token_hash = :h)
                     AND revoked_at IS NULL"""
            ),
            {"h": hash_token(refresh_token)},
        )

    @staticmethod
    async def dev_login(db: AsyncSession, email: str, full_name: Optional[str]) -> SessionTokens:
        if settings.ENVIRONMENT != "development" or not settings.AUTH_DEV_LOGIN:
            raise AuthDisabled()
        user_id = await AuthService._upsert_user(db, email, full_name, None, None)
        return await AuthService._login(db, user_id, email, full_name, None)
