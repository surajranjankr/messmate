"""
MessMate External Integrations Base Abstractions
================================================
Defines interfaces and common error types for external service adapters
such as Email (Resend) and Messaging (WhatsApp).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from pydantic import BaseModel


class EmailMessage(BaseModel):
    to: List[str]
    subject: str
    html_content: str
    text_content: Optional[str] = None
    from_email: Optional[str] = None


class EmailResult(BaseModel):
    success: bool
    message_id: Optional[str] = None
    provider: str
    error: Optional[str] = None


class BaseEmailClient(ABC):
    """Abstract base class for email delivery providers."""

    @abstractmethod
    async def send_email(self, message: EmailMessage) -> EmailResult:
        """Send an email message through the provider."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Check whether provider credentials are valid and present."""
        pass
