import re
from types import SimpleNamespace

import pytest
from sqlalchemy import text

import app.core.email as email_pkg
from app.core.errors import APIException, BadRequestException, UnauthorizedException
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


async def sign_up(db, mail, email="new.person@example.com", password="correct horse"):
    await AuthService.email_start(db, email, password)
    return await AuthService.email_verify(db, email, code_from(mail), "/saved")


@pytest.mark.asyncio
async def test_sign_up_confirms_email_then_password_login_works(db, mail):
    tokens = await sign_up(db, mail)
    assert mail.sent[-1]["to_email"] == "new.person@example.com"
    assert tokens.next == "/saved"
    role = (await db.execute(text("SELECT role FROM profiles WHERE id = CAST(:i AS uuid)"), {"i": tokens.user_id})).scalar_one()
    assert role == "student"

    again = await AuthService.password_login(db, "New.Person@Example.com", "correct horse", None)
    assert again.user_id == tokens.user_id
    stored = (await db.execute(text("SELECT password_hash FROM auth_credentials"))).scalar_one()
    assert "correct horse" not in stored


@pytest.mark.asyncio
async def test_wrong_password_is_generic_and_locks_after_five(db, mail):
    await sign_up(db, mail)
    for _ in range(5):
        with pytest.raises(UnauthorizedException):
            await AuthService.password_login(db, "new.person@example.com", "nope nope", None)
    with pytest.raises(APIException):  # locked: even the right password is refused for a while
        await AuthService.password_login(db, "new.person@example.com", "correct horse", None)
    with pytest.raises(UnauthorizedException):  # unknown address gives the same answer as a wrong password
        await AuthService.password_login(db, "nobody@example.com", "whatever1", None)


@pytest.mark.asyncio
async def test_forgot_password_sets_a_new_one_and_unlocks(db, mail):
    await sign_up(db, mail)
    await AuthService.email_start(db, "new.person@example.com")  # forgot: no password sent
    await AuthService.email_verify(db, "new.person@example.com", code_from(mail), None, "brand new pass")
    with pytest.raises(UnauthorizedException):
        await AuthService.password_login(db, "new.person@example.com", "correct horse", None)
    assert (await AuthService.password_login(db, "new.person@example.com", "brand new pass", None)).access_token


@pytest.mark.asyncio
async def test_a_code_alone_signs_in_without_a_password(db, mail):
    await AuthService.email_start(db, "lonely@example.com")
    tokens = await AuthService.email_verify(db, "lonely@example.com", code_from(mail), "/saved")
    assert tokens.access_token and tokens.next == "/saved"
    creds = (await db.execute(text("SELECT count(*) FROM public.auth_credentials WHERE user_id = CAST(:u AS uuid)"), {"u": tokens.user_id})).scalar_one()
    assert creds == 0
    # The next code signs the same account in again.
    await AuthService.email_start(db, "lonely@example.com")
    again = await AuthService.email_verify(db, "lonely@example.com", code_from(mail), None)
    assert again.user_id == tokens.user_id


@pytest.mark.asyncio
async def test_a_code_alone_keeps_an_existing_password(db, mail):
    await sign_up(db, mail)
    await AuthService.email_start(db, "new.person@example.com")
    await AuthService.email_verify(db, "new.person@example.com", code_from(mail), None)
    assert (await AuthService.password_login(db, "new.person@example.com", "correct horse", None)).access_token


@pytest.mark.asyncio
async def test_wrong_code_locks_after_five_and_codes_work_once(db, mail):
    await AuthService.email_start(db, "lock@example.com", "long enough pw")
    good = code_from(mail)
    bad = "000000" if good != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(UnauthorizedException):
            await AuthService.email_verify(db, "lock@example.com", bad, None)
    with pytest.raises(UnauthorizedException):
        await AuthService.email_verify(db, "lock@example.com", good, None)

    await AuthService.email_start(db, "once@example.com", "long enough pw")
    code = code_from(mail)
    await AuthService.email_verify(db, "once@example.com", code, None)
    with pytest.raises(UnauthorizedException):
        await AuthService.email_verify(db, "once@example.com", code, None)


@pytest.mark.asyncio
async def test_google_account_keeps_its_user_when_a_password_is_added(db, mail):
    google_id = await AuthService._upsert_user(db, "both@example.com", "Both", None, "sub-9")
    tokens = await sign_up(db, mail, "both@example.com", "a fine password")
    assert tokens.user_id == google_id
    assert (await AuthService.password_login(db, "both@example.com", "a fine password", "//evil.example")).next is None


@pytest.mark.asyncio
async def test_short_password_invalid_email_hourly_limit_and_send_failure(db, mail, monkeypatch):
    with pytest.raises(BadRequestException):
        await AuthService.email_start(db, "short@example.com", "1234567")
    with pytest.raises(BadRequestException):
        await AuthService.email_start(db, "not-an-email")
    for _ in range(5):
        await AuthService.email_start(db, "spam@example.com")
    with pytest.raises(APIException):
        await AuthService.email_start(db, "spam@example.com")
    monkeypatch.setattr(email_pkg, "_email_service", FakeEmail(success=False))
    with pytest.raises(APIException):
        await AuthService.email_start(db, "fail@example.com")


@pytest.mark.asyncio
async def test_magic_link_code_signs_in_once(db, mail):
    from urllib.parse import parse_qs, urlsplit

    await AuthService.email_start(db, "linky@example.com", None, "/saved")
    link = re.search(r"https://rumia\.co\.ke/auth/magic#\S+", mail.sent[-1]["text_content"]).group(0)
    fields = parse_qs(urlsplit(link).fragment)
    tokens = await AuthService.email_verify(db, fields["e"][0], fields["c"][0], fields["n"][0])
    assert tokens.access_token and tokens.next == "/saved"
    with pytest.raises(UnauthorizedException):
        await AuthService.email_verify(db, fields["e"][0], fields["c"][0], fields["n"][0])
