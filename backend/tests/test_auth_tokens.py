import time

import pytest
from jose import JWTError, jwt

from app.core import tokens
from app.core.config import settings
from app.core.security import decode_jwt_token
from app.features.auth.service import safe_app_redirect, safe_next


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_JWT_SECRET", "x" * 40)


def test_own_access_token_roundtrip_through_security():
    t = tokens.create_access_token("11111111-1111-1111-1111-111111111111", "a@b.co", "A", None)
    data = decode_jwt_token(t)
    assert data.user_id == "11111111-1111-1111-1111-111111111111"
    assert data.email == "a@b.co"


def test_expired_and_tampered_tokens_rejected(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_ACCESS_TTL_SECONDS", -10)
    t = tokens.create_access_token("u", "a@b.co", None, None)
    with pytest.raises(Exception):
        decode_jwt_token(t)
    monkeypatch.setattr(settings, "AUTH_ACCESS_TTL_SECONDS", 60)
    good = tokens.create_access_token("u", "a@b.co", None, None)
    forged = jwt.encode(jwt.get_unverified_claims(good), "y" * 40, algorithm="HS256")
    with pytest.raises(Exception):
        decode_jwt_token(forged)


def test_state_token_cannot_be_used_as_access_token():
    state = tokens.create_signed_state({"nonce": "n"})
    with pytest.raises(JWTError):
        tokens.decode_own_access_token(state)  # no rumia issuer
    assert tokens.decode_signed_state(state)["nonce"] == "n"
    access = tokens.create_access_token("u", None, None, None)
    with pytest.raises(JWTError):
        tokens.decode_signed_state(access)


def test_refresh_hash_is_stable_and_opaque():
    t = tokens.new_opaque_token()
    assert tokens.hash_token(t) == tokens.hash_token(t) != t


def test_redirect_allowlists():
    assert safe_next("/dashboard") == "/dashboard"
    assert safe_next("//evil.com") is None
    assert safe_next("https://evil.com") is None
    assert safe_app_redirect("rumia://auth") == "rumia://auth"
    assert safe_app_redirect("evil://x") is None
