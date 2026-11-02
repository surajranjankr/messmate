import pytest
from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models.meal import MealInstance

def test_record_and_get_outcome(client, vendor_auth_headers, db_session):
    meal = MealInstance(
        id="mi-test-outcome",
        meal_date="2026-11-06",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
        status="RESPONSE_CLOSED",
    )
    db_session.add(meal)
    db_session.commit()

    # Vendor records actual outcome
    res = client.post(
        "/api/v1/outcomes/mi-test-outcome",
        headers=vendor_auth_headers,
        json={
            "actualAttendance": 680,
            "actualPreparedQuantity": 720,
            "preparedUnit": "portions",
            "leftoverQuantity": 15.5,
            "leftoverUnit": "kg",
            "notes": "Curd rice leftover recorded cleanly.",
        },
    )
    assert res.status_code == status.HTTP_200_OK
    outcome = res.json()
    assert outcome["actualAttendance"] == 680
    assert outcome["actualPreparedQuantity"] == 720
    assert outcome["preparedUnit"] == "portions"
    assert outcome["leftoverQuantity"] == 15.5
    assert outcome["leftoverUnit"] == "kg"

    # Get outcome
    res_get = client.get("/api/v1/outcomes/mi-test-outcome", headers=vendor_auth_headers)
    assert res_get.status_code == status.HTTP_200_OK
    assert res_get.json()["actualAttendance"] == 680

def test_student_cannot_record_outcome(client, student_auth_headers, db_session):
    res = client.post(
        "/api/v1/outcomes/mi-test-outcome",
        headers=student_auth_headers,
        json={"actualAttendance": 680},
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN
