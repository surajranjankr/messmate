"""
MessMate WhatsApp Integration (Deferred Milestone)
=================================================
Per Phase 3 specifications, WhatsApp integration (Meta Cloud API / Twilio)
is officially deferred. In-app notifications are retained as primary.
This module documents the interface contract for future implementation.
"""

from typing import Optional, List
from pydantic import BaseModel


class WhatsAppMessage(BaseModel):
    recipient_phone: str
    template_name: str
    parameters: List[str]


class WhatsAppResult(BaseModel):
    success: bool
    status: str = "DEFERRED"
    message: str = "WhatsApp integration is deferred; in-app notification retained."


class DeferredWhatsAppClient:
    """Placeholder client representing the deferred WhatsApp capability."""

    def is_configured(self) -> bool:
        return False

    async def send_message(self, message: WhatsAppMessage) -> WhatsAppResult:
        return WhatsAppResult()
