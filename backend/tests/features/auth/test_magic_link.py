from urllib.parse import parse_qs, urlsplit

from app.core.email.templates import sign_in_code_email
from app.features.auth.service import magic_link


def test_link_keeps_the_secret_in_the_fragment():
    url = magic_link("wanjiru@example.com", "482913", "/saved")
    parts = urlsplit(url)
    assert f"{parts.scheme}://{parts.netloc}{parts.path}" == "https://rumia.co.ke/auth/magic"
    assert parts.query == ""  # nothing a server or a mail scanner would log
    assert parse_qs(parts.fragment) == {"e": ["wanjiru@example.com"], "c": ["482913"], "n": ["/saved"]}


def test_unsafe_next_falls_back_to_account():
    url = magic_link("a@example.com", "000000", "//evil.example/x")
    assert parse_qs(urlsplit(url).fragment)["n"] == ["/account"]


def test_no_link_unless_asked():
    assert magic_link("a@example.com", "000000", None) is None


def test_email_carries_button_and_code():
    link = magic_link("a@example.com", "123456", "/")
    mail = sign_in_code_email(code="123456", minutes=10, link=link)
    assert "Sign in to Rumia</a>" in mail.html and "123456" in mail.html
    assert link.replace("&", "&amp;") in mail.html
    assert link in mail.text and "123456" in mail.text


def test_code_only_email_is_unchanged_for_hosts():
    mail = sign_in_code_email(code="123456", minutes=10)
    assert "Sign in to Rumia</a>" not in mail.html and "123456" in mail.html
