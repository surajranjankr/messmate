import pytest
from datetime import datetime, timezone, timedelta
from fastapi import status
from app.models.meal import MealInstance

def test_forecast_recommendation_default_formula(client, db_session):
    meal = MealInstance(
        id="mi-test-forecast",
        meal_date="2026-11-06",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        status="RESPONSE_OPEN",
    )
    db_session.add(meal)
    db_session.commit()

    res = client.get("/api/v1/forecasts/recommendation/mi-test-forecast")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["baselineAttendance"] == 700
    assert data["safetyMarginFraction"] == 0.08
    assert data["recommendedPortions"] == 756  # ceil(700 * 1.08)
    assert data["forecastMethod"] in ["BASELINE_ONLY", "BASELINE_WITH_SAFETY_MARGIN"]

def test_vendor_decision_and_preservation(client, vendor_auth_headers, db_session):
    meal = MealInstance(
        id="mi-test-decision",
        meal_date="2026-11-06",
        meal_type="DINNER",
        menu_version_id="menu-v1",
        response_deadline=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        status="RESPONSE_OPEN",
    )
    db_session.add(meal)
    db_session.commit()

    # Vendor submits planned portions = 730 with override reason
    res = client.post(
        "/api/v1/forecasts/decision/mi-test-decision",
        headers=vendor_auth_headers,
        json={
            "finalPlannedQuantity": 730,
            "overrideReason": "Exam week lighter dinner attendance expected",
        },
    )
    assert res.status_code == status.HTTP_200_OK
    decision = res.json()
    assert decision["originalRecommendation"] == 756
    assert decision["finalPlannedQuantity"] == 730
    assert decision["overrideReason"] == "Exam week lighter dinner attendance expected"
    assert decision["status"] in ["OVERRIDDEN", "ACCEPTED", "CONFIRMED"]

def test_student_cannot_submit_decision(client, student_auth_headers, db_session):
    meal = MealInstance(
        id="mi-test-forbidden",
        meal_date="2026-11-06",
        meal_type="BREAKFAST",
        menu_version_id="menu-v1",
        response_deadline=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        status="RESPONSE_OPEN",
    )
    db_session.add(meal)
    db_session.commit()

    res = client.post(
        "/api/v1/forecasts/decision/mi-test-forbidden",
        headers=student_auth_headers,
        json={"finalPlannedQuantity": 700},
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN
