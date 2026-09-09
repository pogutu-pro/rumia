"""Email rendering + delivery orchestration for Rumia notifications."""
from app.core.email.provider import (
    EmailAddress,
    EmailProvider,
    SendEmailCommand,
)

RUMIA_SETTINGS_URL = "https://rumia.co.ke/account?tab=settings"


class EmailService:
    """Provider-agnostic email service.

    Business logic depends only on this class (plus the EmailProvider protocol);
    the concrete provider (Brevo) is injected.
    """

    def __init__(self, provider: EmailProvider) -> None:
        self._provider = provider

    @property
    def provider_name(self) -> str:
        return self._provider.name

    async def send(
        self,
        *,
        to_email: str,
        to_name: str | None,
        subject: str,
        html_content: str,
        text_content: str | None = None,
        tags: list[str] | None = None,
    ):
        command = SendEmailCommand(
            to=EmailAddress(email=to_email, name=to_name),
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            tags=tags,
        )
        return await self._provider.send(command)

    async def check_status(self, provider_message_id: str):
        """Return the provider's latest delivery status for a message.

        Providers that can't check status (or don't implement it) return None.
        """
        check = getattr(self._provider, "check_status", None)
        if check is None:
            return None
        return await check(provider_message_id)