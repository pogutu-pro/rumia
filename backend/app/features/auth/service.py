import base64
import hashlib
import hmac
import json
import re
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
REUSE_GRACE_SECONDS = 10
EMAIL_CODE_TTL_MINUTES = 10
EMAIL_CODE_MAX_ATTEMPTS = 5
EMAIL_CODES_PER_HOUR = 5
PASSWORD_MIN_LENGTH = 8
LOGIN_MAX_FAILURES = 5
LOGIN_LOCK_MINUTES = 15
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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
    _DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

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

    # ---- Passwords -----------------------------------------------------------------------
    @staticmethod
    def _hash_password(password: str) -> str:
        salt = secrets.token_bytes(16)
        digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
        return f"scrypt${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"

    @staticmethod
    def _check_password(password: str, stored: str) -> bool:
        try:
            _, salt, digest = stored.split("$")
            expected = base64.b64decode(digest)
            actual = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=2**14, r=8, p=1, dklen=len(expected))
        except Exception:
            return False
        return hmac.compare_digest(actual, expected)

    @staticmethod
    def _validate_password(password: str) -> None:
        if len(password) < PASSWORD_MIN_LENGTH:
            raise BadRequestException(f"Use at least {PASSWORD_MIN_LENGTH} characters for your password")

    @staticmethod
    async def password_login(db: AsyncSession, raw_email: str, password: str, next_path: Optional[str]) -> SessionTokens:
        email = (raw_email or "").strip().lower()
        generic = UnauthorizedException("Incorrect email or password")
        row = (
            await db.execute(
                text(
                    """SELECT u.id, c.password_hash, c.failed_attempts, c.locked_until
                       FROM auth.users u JOIN public.auth_credentials c ON c.user_id = u.id
                       WHERE lower(u.email) = :e FOR UPDATE OF c"""
                ),
                {"e": email},
            )
        ).first()
        if row is None:
            AuthService._check_password(password, AuthService._DUMMY_HASH)  # same cost whether or not the account exists
            raise generic
        if row.locked_until is not None and row.locked_until > _now():
            raise APIException(status_code=429, code="LOCKED", message="Too many wrong passwords. Try again in a few minutes, or reset your password.")
        if not AuthService._check_password(password, row.password_hash):
            await db.execute(
                text(
                    """UPDATE public.auth_credentials
                       SET failed_attempts = failed_attempts + 1,
                           locked_until = CASE WHEN failed_attempts + 1 >= :max THEN now() + make_interval(mins => :mins) END
                       WHERE user_id = :u"""
                ),
                {"u": row.id, "max": LOGIN_MAX_FAILURES, "mins": LOGIN_LOCK_MINUTES},
            )
            await db.commit()  # keep the count even though we reject the request
            raise generic
        await db.execute(text("UPDATE public.auth_credentials SET failed_attempts = 0, locked_until = NULL WHERE user_id = :u"), {"u": row.id})
        tokens = await AuthService._login(db, str(row.id), email, None, None)
        tokens.next = safe_next(next_path)
        return tokens

    # ---- Email code ----------------------------------------------------------------------
    @staticmethod
    def _code_hash(email: str, code: str) -> str:
        return hash_token(f"{email}:{code}")

    @staticmethod
    def _clean_email(raw: str) -> str:
        email = (raw or "").strip().lower()
        if not EMAIL_RE.match(email):
            raise BadRequestException("Enter a valid email address")
        return email

    @staticmethod
    async def email_start(db: AsyncSession, raw_email: str, password: Optional[str] = None) -> None:
        """Email a 6-digit code (sign-up when a password is given, otherwise forgot-password).

        The password is only stored, hashed, with the code; it becomes the account's password once the code is confirmed."""
        email = AuthService._clean_email(raw_email)
        if password is not None:
            AuthService._validate_password(password)
        recent = (
            await db.execute(
                text("SELECT count(*) FROM public.auth_email_codes WHERE email = :e AND created_at > now() - interval '1 hour'"),
                {"e": email},
            )
        ).scalar_one()
        if recent >= EMAIL_CODES_PER_HOUR:
            raise APIException(status_code=429, code="RATE_LIMITED", message="Too many codes requested. Try again in a while.")
        code = f"{secrets.randbelow(10**6):06d}"
        await db.execute(
            text(
                """INSERT INTO public.auth_email_codes (email, code_hash, expires_at, pending_password_hash)
                   VALUES (:e, :h, :exp, :p)"""
            ),
            {
                "e": email, "h": AuthService._code_hash(email, code), "exp": _now() + timedelta(minutes=EMAIL_CODE_TTL_MINUTES),
                "p": AuthService._hash_password(password) if password is not None else None,
            },
        )
        # Commit before sending so the code exists by the time the email lands.
        await db.commit()

        from app.core.email import email_service
        from app.core.email.templates import sign_in_code_email

        mail = sign_in_code_email(code=code, minutes=EMAIL_CODE_TTL_MINUTES)
        result = await email_service.send(
            to_email=email, to_name=None, subject=mail.subject, html_content=mail.html, text_content=mail.text, tags=["sign-in-code"],
        )
        if not getattr(result, "success", False):
            raise APIException(status_code=503, code="EMAIL_UNAVAILABLE", message="We could not send the email. Please try again.")

    @staticmethod
    async def email_verify(
        db: AsyncSession, raw_email: str, code: str, next_path: Optional[str], new_password: Optional[str] = None
    ) -> SessionTokens:
        """Confirm the emailed code and set the account's password (the one given at sign-up, or `new_password`)."""
        email = AuthService._clean_email(raw_email)
        if new_password is not None:
            AuthService._validate_password(new_password)
        row = (
            await db.execute(
                text(
                    """SELECT id, code_hash, attempts, pending_password_hash FROM public.auth_email_codes
                       WHERE email = :e AND used_at IS NULL AND expires_at > now()
                       ORDER BY created_at DESC LIMIT 1 FOR UPDATE"""
                ),
                {"e": email},
            )
        ).first()
        if row is None or row.attempts >= EMAIL_CODE_MAX_ATTEMPTS:
            raise UnauthorizedException("That code has expired. Request a new one.")
        if not hmac.compare_digest(row.code_hash, AuthService._code_hash(email, code.strip())):
            await db.execute(text("UPDATE public.auth_email_codes SET attempts = attempts + 1 WHERE id = :i"), {"i": row.id})
            await db.commit()  # keep the count even though we reject the request
            raise UnauthorizedException("That code is not right. Check it and try again.")
        await db.execute(text("UPDATE public.auth_email_codes SET used_at = now() WHERE id = :i"), {"i": row.id})
        password_hash = AuthService._hash_password(new_password) if new_password is not None else row.pending_password_hash
        if password_hash is None:
            raise BadRequestException("Choose a password to finish.")
        user_id = await AuthService._upsert_user(db, email, None, None, None)
        await db.execute(
            text(
                """INSERT INTO public.auth_credentials (user_id, password_hash) VALUES (CAST(:u AS uuid), :h)
                   ON CONFLICT (user_id) DO UPDATE
                     SET password_hash = :h, failed_attempts = 0, locked_until = NULL, updated_at = now()"""
            ),
            {"u": user_id, "h": password_hash},
        )
        tokens = await AuthService._login(db, user_id, email, None, None)
        tokens.next = safe_next(next_path)
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
        if row.used_at is not None and kind == "refresh" and (_now() - row.used_at).total_seconds() <= REUSE_GRACE_SECONDS:
            # Two tabs/requests refreshed with the same token at once: let the loser through on the
            # same family instead of treating a benign race as theft.
            return row
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
