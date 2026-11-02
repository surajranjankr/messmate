import pytest
from fastapi import status

def test_get_all_28_schedules(client):
    res = client.get("/api/v1/schedules")
    assert res.status_code == status.HTTP_200_OK
    schedules = res.json()
    assert len(schedules) == 28

def test_validate_schedules_initially_valid(client):
    res = client.get("/api/v1/schedules/validate")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["isValid"] is True
    assert len(data["errors"]) == 0

def test_student_cannot_update_schedule(client, student_auth_headers):
    res = client.patch(
        "/api/v1/schedules/schedule-monday-breakfast",
        headers=student_auth_headers,
        json={"notifySendTime": "20:00"},
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN

def test_admin_update_schedule(client, admin_auth_headers):
    res = client.patch(
        "/api/v1/schedules/schedule-monday-breakfast",
        headers=admin_auth_headers,
        json={"notifySendTime": "20:30", "responseDeadlineTime": "21:30"},
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["notifySendTime"] == "20:30"
    assert data["responseDeadlineTime"] == "21:30"

def test_admin_acknowledge_overlap(client, admin_auth_headers):
    res = client.post(
        "/api/v1/schedules/acknowledge-overlap",
        headers=admin_auth_headers,
        json={"schedule_id": "schedule-monday-breakfast", "acknowledged": True},
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["overlapAcknowledged"] is True
