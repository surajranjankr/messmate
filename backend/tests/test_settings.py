import pytest
from fastapi import status


def test_get_settings_default(client, admin_auth_headers):
    res = client.get("/api/v1/settings", headers=admin_auth_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["id"] == "default"
    assert "safetyMarginPercentage" in data
    assert "safetyMarginFraction" in data
    assert "IIIT Dharwad" in data["institutionName"]


def test_update_settings_validation(client, admin_auth_headers):
    # Over 50% must be rejected
    res = client.put(
        "/api/v1/settings",
        json={"safetyMarginPercentage": 55.0},
        headers=admin_auth_headers,
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Negative margin must be rejected
    res = client.put(
        "/api/v1/settings",
        json={"safetyMarginPercentage": -5.0},
        headers=admin_auth_headers,
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_update_settings_success_and_forecast_impact(client, admin_auth_headers):
    # 1. Update safety margin to 20%
    res = client.put(
        "/api/v1/settings",
        json={
            "institutionName": "IIIT Dharwad Main Campus",
            "safetyMarginPercentage": 20.0,
        },
        headers=admin_auth_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    updated = res.json()
    assert updated["safetyMarginPercentage"] == 20.0
    assert updated["safetyMarginFraction"] == 0.20
    assert updated["institutionName"] == "IIIT Dharwad Main Campus"

    # 2. Check GET /settings persists the update
    res_get = client.get("/api/v1/settings", headers=admin_auth_headers)
    assert res_get.status_code == status.HTTP_200_OK
    persisted = res_get.json()
    assert persisted["safetyMarginPercentage"] == 20.0
    assert persisted["safetyMarginFraction"] == 0.20

    # 3. Check forecast recommendation reflects 20% dynamic safety margin
    # Find a meal instance
    meals_res = client.get("/api/v1/meals?status=RESPONSE_OPEN", headers=admin_auth_headers)
    assert meals_res.status_code == status.HTTP_200_OK
    meals = meals_res.json()
    assert len(meals) > 0
    meal_id = meals[0]["id"]

    rec_res = client.get(f"/api/v1/forecasts/recommendation/{meal_id}", headers=admin_auth_headers)
    assert rec_res.status_code == status.HTTP_200_OK
    rec = rec_res.json()
    assert rec["safetyMarginFraction"] == 0.20
    assert "Dynamic demand model" in rec["explanation"]

    # 4. Restore setting back to 8% for test cleanliness
    client.put(
        "/api/v1/settings",
        json={
            "institutionName": "Indian Institute of Information Technology Dharwad",
            "safetyMarginPercentage": 8.0,
        },
        headers=admin_auth_headers,
    )


def test_student_cannot_update_settings(client, student_auth_headers):
    res = client.put(
        "/api/v1/settings",
        json={"safetyMarginPercentage": 15.0},
        headers=student_auth_headers,
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN
