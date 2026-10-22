import app.core.email as email_pkg
from app.core.config import settings
from app.core.email.service import EmailService
from app.features.auth.service import AuthService


class _Provider:
    name = "fake"

    def __init__(self, configured: bool):
        self.is_configured = configured


def test_email_is_offered_only_when_mail_can_be_sent(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "https://rumia.co.ke/auth/google/callback")

    monkeypatch.setattr(email_pkg, "_email_service", EmailService(provider=_Provider(False)))
    assert AuthService.sign_in_methods() == {"google": True, "email": False}

    monkeypatch.setattr(email_pkg, "_email_service", EmailService(provider=_Provider(True)))
    assert AuthService.sign_in_methods() == {"google": True, "email": True}


def test_google_needs_its_full_config(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "")
    monkeypatch.setattr(email_pkg, "_email_service", EmailService(provider=_Provider(True)))
    assert AuthService.sign_in_methods()["google"] is False
