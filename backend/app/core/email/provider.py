"""Email provider abstraction.

Rumia's notification system is agnostic of the concrete email provider. All
notification code depends on the `EmailProvider` protocol below, so the
provider (Brevo today) can be replaced without touching business logic.
"""
from dataclasses import dataclass
from typing import Awaitable, List, Optional, Protocol


@dataclass
class EmailAddress:
    email: str
    name: Optional[str] = None

    def as_brevo_format(self) -> dict:
        return {"email": self.email, "name": self.name} if self.name else {"email": self.email}


@dataclass
class SendEmailCommand:
    to: EmailAddress
    subject: str
    html_content: str
    text_content: Optional[str] = None
    reply_to: Optional[EmailAddress] = None
    tags: Optional[List[str]] = None


@dataclass
class SendEmailResult:
    success: bool
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class EmailEvent:
    """Normalized delivery event from a provider webhook."""

    provider_message_id: str
    event: str  # delivered | bounced | blocked | deferred | opened | clicked | failed
    timestamp: Optional[str] = None
    reason: Optional[str] = None


class EmailProvider(Protocol):
    """Interface for transactional email providers (Brevo, SendGrid, etc.)."""

    name: str

    async def send(self, command: SendEmailCommand) -> SendEmailResult: ...

    def parse_webhook(self, payload: dict) -> List[EmailEvent]: ...