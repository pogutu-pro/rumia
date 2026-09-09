import base64
import time
import pytest
from fastapi import APIRouter, Depends, status
from httpx import ASGITransport, AsyncClient
from jose import jwt

from cryptography.hazmat.primitives.asymmetric import ec

from app.core import security
from app.core.config import settings
from app.core.errors import ForbiddenException, UnauthorizedException
from app.core.security import (
    AuthenticatedUser,
    check_ownership,
    decode_jwt_token,
    get_current_user,
    require_roles,
)
from app.main import app

# Test router for security tests
sec_test_router = APIRouter(prefix="/api/v1/test-security", tags=["Test Security"])


@sec_test_router.get("/protected")
async def protected_endpoint(user: AuthenticatedUser = Depends(get_current_user)):
    return {"status": "success", "user_id": user.id, "role": user.role}


@sec_test_router.get("/admin-only")
async def admin_only_endpoint(user: AuthenticatedUser = Depends(require_roles("admin"))):
    return {"status": "success", "user_id": user.id, "role": user.role}


@sec_test_router.get("/manager-or-admin")
async def manager_or_admin_endpoint(user: AuthenticatedUser = Depends(require_roles("manager", "admin"))):
    return {"status": "success", "user_id": user.id, "role": user.role}


# Include test security router into main app for test execution
app.include_router(sec_test_router)


def create_test_token(user_id: str, email: str = "user@example.com", role: str = "authenticated", expires_in: int = 3600, secret: str = None) -> str:
    secret = secret or settings.SUPABASE_JWT_SECRET
    assert secret, "SUPABASE_JWT_SECRET must be set for token fixtures (see tests/conftest.py)"
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": int(time.time()) + expires_in,
        "iss": "supabase",
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _b64u_encode_int(value: int) -> str:
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _make_es256_jwk(secret_key) -> dict:
    public_numbers = secret_key.public_key().public_numbers()
    return {
        "alg": "ES256",
        "crv": "P-256",
        "kid": "es256-kid-1",
        "kty": "EC",
        "use": "sig",
        "x": _b64u_encode_int(public_numbers.x),
        "y": _b64u_encode_int(public_numbers.y),
    }


def _create_es256_token(secret_key, kid: str, user_id: str = "user-es256", expires_in: int = 3600) -> str:
    payload = {
        "sub": user_id,
        "email": "es@rumia.app",
        "role": "authenticated",
        "exp": int(time.time()) + expires_in,
        "iss": "supabase",
    }
    return jwt.encode(payload, secret_key, algorithm="ES256", headers={"kid": kid})


@pytest.mark.asyncio
async def test_decode_es256_jwt_token_via_jwks(monkeypatch):
    secret_key = ec.generate_private_key(ec.SECP256R1())
    jwk = _make_es256_jwk(secret_key)
    monkeypatch.setattr(security, "_JWKS_KEYS", {jwk["kid"]: jwk})
    monkeypatch.setattr(security, "_JWKS_FETCHED_AT", time.time())

    token = _create_es256_token(secret_key, kid=jwk["kid"])
    token_data = decode_jwt_token(token)
    assert token_data.user_id == "user-es256"
    assert token_data.email == "es@rumia.app"


@pytest.mark.asyncio
async def test_decode_es256_jwt_token_unknown_kid(monkeypatch):
    secret_key = ec.generate_private_key(ec.SECP256R1())
    jwk = _make_es256_jwk(secret_key)
    monkeypatch.setattr(security, "_JWKS_KEYS", {jwk["kid"]: jwk})
    monkeypatch.setattr(security, "_JWKS_FETCHED_AT", time.time())

    token = _create_es256_token(secret_key, kid="unseen-kid")
    with pytest.raises(UnauthorizedException) as exc_info:
        decode_jwt_token(token)
    assert exc_info.value.status_code == 401
    assert "Unknown JWT signing key id" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_decode_expired_es256_jwt_token(monkeypatch):
    secret_key = ec.generate_private_key(ec.SECP256R1())
    jwk = _make_es256_jwk(secret_key)
    monkeypatch.setattr(security, "_JWKS_KEYS", {jwk["kid"]: jwk})
    monkeypatch.setattr(security, "_JWKS_FETCHED_AT", time.time())

    token = _create_es256_token(secret_key, kid=jwk["kid"], expires_in=-10)
    with pytest.raises(UnauthorizedException):
        decode_jwt_token(token)


@pytest.mark.asyncio
async def test_decode_valid_jwt_token():
    token = create_test_token(user_id="user-123", email="test@rumia.app")
    token_data = decode_jwt_token(token)
    assert token_data.user_id == "user-123"
    assert token_data.email == "test@rumia.app"


@pytest.mark.asyncio
async def test_decode_expired_jwt_token():
    token = create_test_token(user_id="user-123", expires_in=-10)
    with pytest.raises(UnauthorizedException) as exc_info:
        decode_jwt_token(token)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_decode_invalid_signature_jwt_token():
    token = create_test_token(user_id="user-123", secret="wrong-secret-key-123")
    with pytest.raises(UnauthorizedException) as exc_info:
        decode_jwt_token(token)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_unauthenticated(client: AsyncClient):
    response = await client.get("/api/v1/test-security/protected")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_bad_header(client: AsyncClient):
    response = await client.get(
        "/api/v1/test-security/protected",
        headers={"Authorization": "Basic 12345"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_valid_token(client: AsyncClient):
    token = create_test_token(user_id="user-abc-789")
    response = await client.get(
        "/api/v1/test-security/protected",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["user_id"] == "user-abc-789"


@pytest.mark.asyncio
async def test_role_authorization_matrix(client: AsyncClient):
    student_token = create_test_token(user_id="student-1")
    response = await client.get(
        "/api/v1/test-security/admin-only",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert response.status_code == 403

    response = await client.get(
        "/api/v1/test-security/manager-or-admin",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_check_ownership_helper():
    student_user = AuthenticatedUser(id="user-10", role="student")
    admin_user = AuthenticatedUser(id="user-99", role="admin")

    # Owner matches -> True
    assert check_ownership(student_user, "user-10") is True

    # Non-owner non-admin -> raises ForbiddenException
    with pytest.raises(ForbiddenException):
        check_ownership(student_user, "user-20")

    # Admin matches even if non-owner -> True
    assert check_ownership(admin_user, "user-20") is True
