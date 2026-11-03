import pytest
from app.integrations.base import EmailMessage
from app.integrations.email.client import ResendClient, MockEmailClient
from app.integrations.email.service import EmailService


@pytest.mark.asyncio
async def test_mock_email_client_send():
    client = MockEmailClient()
    msg = EmailMessage(
        to=["student@iiitdwd.ac.in"],
        subject="Meal Reminder",
        html_content="<p>Please submit response</p>",
    )
    result = await client.send_email(msg)
    assert result.success is True
    assert result.provider == "mock"
    assert len(client.sent_messages) == 1
    assert client.sent_messages[0].to == ["student@iiitdwd.ac.in"]


@pytest.mark.asyncio
async def test_resend_client_unconfigured_safely_rejects():
    # When api_key is empty/None, send_email should return a clear failure without crashing or throwing
    client = ResendClient(api_key="", from_email="onboarding@resend.dev")
    assert client.is_configured() is False

    msg = EmailMessage(
        to=["student@iiitdwd.ac.in"],
        subject="Meal Reminder",
        html_content="<p>Content</p>",
    )
    result = await client.send_email(msg)
    assert result.success is False
    assert result.provider == "resend"
    assert "not configured" in result.error.lower()


@pytest.mark.asyncio
async def test_email_service_deadline_reminder():
    mock_client = MockEmailClient()
    service = EmailService(client=mock_client)
    res = await service.send_deadline_reminder(
        student_email="arjun@iiitdwd.ac.in",
        student_name="Arjun Sharma",
        meal_name="Lunch",
        deadline_str="09:30 AM IST",
    )
    assert res.success is True
    assert len(mock_client.sent_messages) == 1
    assert "Lunch" in mock_client.sent_messages[0].subject
    assert "09:30 AM IST" in mock_client.sent_messages[0].html_content
