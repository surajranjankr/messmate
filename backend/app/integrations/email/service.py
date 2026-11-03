"""
MessMate High-Level Email Service
=================================
Provides domain-specific email templates and routing logic
(Meal reminders, password reset, admin summaries).
"""

from typing import Optional, List
from app.integrations.base import EmailMessage, EmailResult, BaseEmailClient
from app.integrations.email.client import ResendClient, MockEmailClient
from app.core.config import settings


class EmailService:
    def __init__(self, client: Optional[BaseEmailClient] = None):
        if client:
            self.client = client
        elif settings.EMAIL_PROVIDER.lower() == "resend" and settings.RESEND_API_KEY:
            self.client = ResendClient()
        else:
            self.client = MockEmailClient()

    def is_configured(self) -> bool:
        return self.client.is_configured()

    async def send_deadline_reminder(
        self,
        student_email: str,
        student_name: str,
        meal_name: str,
        deadline_str: str,
    ) -> EmailResult:
        """Sends an urgent meal response cutoff reminder."""
        subject = f"[MessMate] Reminder: {meal_name} Response Deadline Closing Soon"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a;">MessMate Meal Reminder</h2>
            <p>Dear {student_name},</p>
            <p>This is a reminder to submit your meal intention for <strong>{meal_name}</strong>.</p>
            <p>The response deadline is: <strong>{deadline_str}</strong>.</p>
            <p>Submitting your intention helps IIIT Dharwad mess staff prepare the exact amount of food needed and eliminate avoidable waste.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #64748b;">MessMate Demand Forecasting System • IIIT Dharwad</p>
        </div>
        """
        message = EmailMessage(
            to=[student_email],
            subject=subject,
            html_content=html,
            text_content=f"Dear {student_name}, please submit your intention for {meal_name} before {deadline_str}.",
        )
        return await self.client.send_email(message)


# Global singleton instance
_email_service_instance: Optional[EmailService] = None

def get_email_service() -> EmailService:
    global _email_service_instance
    if _email_service_instance is None:
        _email_service_instance = EmailService()
    return _email_service_instance
