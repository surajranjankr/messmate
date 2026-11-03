"""
Resend Email Client Adapter for MessMate
========================================
Implements integration with Resend REST API (https://resend.com)
for transactional emails, deadline notifications, and system alerts.
"""

import httpx
from typing import Optional, List
from app.integrations.base import BaseEmailClient, EmailMessage, EmailResult
from app.core.config import settings


class ResendClient(BaseEmailClient):
    """
    Adapter for Resend HTTP API (https://api.resend.com/emails).
    Requires a valid RESEND_API_KEY.
    """

    API_URL = "https://api.resend.com/emails"

    def __init__(self, api_key: Optional[str] = None, from_email: Optional[str] = None):
        self.api_key = api_key or settings.RESEND_API_KEY
        self.from_email = from_email or settings.EMAIL_FROM

    def is_configured(self) -> bool:
        """Returns True if a non-empty API key is present."""
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    async def send_email(self, message: EmailMessage) -> EmailResult:
        if not self.is_configured():
            return EmailResult(
                success=False,
                provider="resend",
                error="RESEND_API_KEY is not configured. Email was not dispatched.",
            )

        payload = {
            "from": message.from_email or self.from_email,
            "to": message.to,
            "subject": message.subject,
            "html": message.html_content,
        }
        if message.text_content:
            payload["text"] = message.text_content

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.API_URL, json=payload, headers=headers)
                if response.status_code in (200, 201):
                    data = response.json()
                    return EmailResult(
                        success=True,
                        message_id=data.get("id"),
                        provider="resend",
                    )
                else:
                    return EmailResult(
                        success=False,
                        provider="resend",
                        error=f"Resend API error [{response.status_code}]: {response.text}",
                    )
        except httpx.TimeoutException:
            return EmailResult(
                success=False,
                provider="resend",
                error="Resend API request timed out after 10.0s",
            )
        except Exception as exc:
            return EmailResult(
                success=False,
                provider="resend",
                error=f"Unexpected error communicating with Resend: {str(exc)}",
            )


class MockEmailClient(BaseEmailClient):
    """In-memory mock email client for testing and local development."""

    def __init__(self):
        self.sent_messages: List[EmailMessage] = []

    def is_configured(self) -> bool:
        return True

    async def send_email(self, message: EmailMessage) -> EmailResult:
        self.sent_messages.append(message)
        msg_id = f"mock-msg-{len(self.sent_messages)}"
        return EmailResult(
            success=True,
            message_id=msg_id,
            provider="mock",
        )
