"""Email layer for Rumia notifications.

Exposes the provider-agnostic EmailService with the Brevo provider wired by
default. Import `email_service` (lazy-constructed) in business code.
"""
from typing import Optional

from app.core.email.service import EmailService

_email_service: Optional[EmailService] = None


def __getattr__(name: str):
    """Lazily construct the email service to avoid a circular import:
    BrevoProvider (core/integrations/brevo.py) imports email.provider, so the
    provider must not be imported eagerly at package load time.
    """
    if name == "email_service":
        global _email_service
        if _email_service is None:
            from app.core.integrations.brevo import BrevoProvider

            _email_service = EmailService(provider=BrevoProvider())
        return _email_service
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["email_service", "EmailService", "BrevoProvider"]