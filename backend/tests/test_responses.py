import pytest
from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models.meal import MealInstance

def test_student_submit_response_and_update(client, student_auth_headers, db_session):
    # Create a meal instance with future deadline
    future_time = datetime.now(timezone.utc) + timedelta(hours=3)
    meal = MealInstance(
        id="mi-test-future",
        meal_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        meal_type="DINNER",
        menu_version_id="menu-v1",
        response_deadline=future_time.isoformat(),
        status="RESPONSE_OPEN",
    )
    db_session.add(meal)
    db_session.commit()

    # 1. Student submits DEFINITELY_EATING
    res = client.post(
        "/api/v1/responses?meal_instance_id=mi-test-future",
        headers=student_auth_headers,
        json={"choice": "DEFINITELY_EATING"},
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["choice"] == "DEFINITELY_EATING"

    # 2. Student updates to NOT_EATING
    res_update = client.post(
        "/api/v1/responses?meal_instance_id=mi-test-future",
        headers=student_auth_headers,
        json={"choice": "NOT_EATING"},
    )
    assert res_update.status_code == status.HTTP_200_OK
    assert res_update.json()["choice"] == "NOT_EATING"

    # 3. Read back my response
    res_my = client.get(
        "/api/v1/responses/my?meal_instance_id=mi-test-future",
        headers=student_auth_headers,
    )
    assert res_my.status_code == status.HTTP_200_OK
    assert res_my.json()["choice"] == "NOT_EATING"

def test_response_rejected_after_deadline(client, student_auth_headers, db_session):
    # Create a meal instance with past deadline
    past_time = datetime.now(timezone.utc) - timedelta(hours=1)
    meal = MealInstance(
        id="mi-test-past",
        meal_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline=past_time.isoformat(),
        status="RESPONSE_CLOSED",
    )
    db_session.add(meal)
    db_session.commit()

    res = client.post(
        "/api/v1/responses?meal_instance_id=mi-test-past",
        headers=student_auth_headers,
        json={"choice": "DEFINITELY_EATING"},
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "deadline" in res.json()["detail"].lower()

def test_counts_strictly_separate_no_response_from_not_eating(client, student_auth_headers, vendor_auth_headers, db_session):
    past_open = datetime.now(timezone.utc) - timedelta(hours=1)
    future_time = datetime.now(timezone.utc) + timedelta(hours=3)
    meal = MealInstance(
        id="mi-test-counts",
        meal_date="2026-11-05",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_open_time=past_open.isoformat(),
        response_deadline=future_time.isoformat(),
        status="RESPONSE_OPEN",
    )
    db_session.add(meal)
    db_session.commit()

    # Initially 0 responses: all active registered students (3 in seed) are 'noResponse', 'notEating' is 0
    res = client.get("/api/v1/responses/counts/mi-test-counts", headers=vendor_auth_headers)
    assert res.status_code == status.HTTP_200_OK
    counts = res.json()
    assert counts["definitelyEating"] == 0
    assert counts["probablyEating"] == 0
    assert counts["notEating"] == 0
    assert counts["noResponse"] == 3
    assert counts["totalRegistered"] == 3

    # Arjun submits NOT_EATING
    client.post(
        "/api/v1/responses?mealInstanceId=mi-test-counts",
        headers=student_auth_headers,
        json={"choice": "NOT_EATING"},
    )

    res2 = client.get("/api/v1/responses/counts/mi-test-counts", headers=vendor_auth_headers)
    counts2 = res2.json()
    assert counts2["notEating"] == 1
    assert counts2["noResponse"] == 2  # 3 - 1
    assert counts2["totalRegistered"] == 3
    assert counts2["definitelyEating"] == 0
