import re
from types import SimpleNamespace

import pytest
from sqlalchemy import text

import app.core.email as email_pkg
from app.core.errors import APIException, UnauthorizedException
from app.features.auth.service import AuthService


class FakeEmail:
    def __init__(self, success=True):
        self.sent = []
        self.success = success

    async def send(self, **kwargs):
        self.sent.append(kwargs)
        return SimpleNamespace(success=self.success)


@pytest.fixture
def mail(monkeypatch):
    fake = FakeEmail()
    monkeypatch.setattr(email_pkg, "_email_service", fake)
    return fake


def code_from(mail: FakeEmail) -> str:
    return re.search(r"\b(\d{6})\b", mail.sent[-1]["text_content"]).group(1)


@pytest.mark.asyncio
async def test_emailed_code_signs_in_once(db, mail):
    await AuthService.email_start(db, "New.Person@Example.com")
    assert mail.sent[-1]["to_email"] == "new.person@example.com"
    code = code_from(mail)

    tokens = await AuthService.email_verify(db, "new.person@example.com", code, "/saved")
    assert tokens.access_token and tokens.refresh_token and tokens.next == "/saved"
    role = (await db.execute(text("SELECT role FROM profiles WHERE id = CAST(:i AS uuid)"), {"i": tokens.user_id})).scalar_one()
    assert role == "student"

    with pytest.raises(UnauthorizedException):  # a used code cannot be replayed
        await AuthService.email_verify(db, "new.person@example.com", code, None)


@pytest.mark.asyncio
async def test_wrong_code_is_rejected_and_locks_after_five_tries(db, mail):
    await AuthService.email_start(db, "lock@example.com")
    good = code_from(mail)
    bad = "000000" if good != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(UnauthorizedException):
            await AuthService.email_verify(db, "lock@example.com", bad, None)
    with pytest.raises(UnauthorizedException):  # even the right code is refused now
        await AuthService.email_verify(db, "lock@example.com", good, None)


@pytest.mark.asyncio
async def test_same_account_whether_email_or_google_and_unsafe_next_dropped(db, mail):
    google_id = await AuthService._upsert_user(db, "both@example.com", "Both", None, "sub-9")
    await AuthService.email_start(db, "both@example.com")
    tokens = await AuthService.email_verify(db, "both@example.com", code_from(mail), "//evil.example")
    assert tokens.user_id == google_id
    assert tokens.next is None


@pytest.mark.asyncio
async def test_invalid_email_and_hourly_limit(db, mail):
    with pytest.raises(Exception):
        await AuthService.email_start(db, "not-an-email")
    for _ in range(5):
        await AuthService.email_start(db, "spam@example.com")
    with pytest.raises(APIException):
        await AuthService.email_start(db, "spam@example.com")


@pytest.mark.asyncio
async def test_send_failure_is_reported(db, monkeypatch):
    monkeypatch.setattr(email_pkg, "_email_service", FakeEmail(success=False))
    with pytest.raises(APIException):
        await AuthService.email_start(db, "fail@example.com")
