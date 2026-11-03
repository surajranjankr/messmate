"""
MessMate MongoDB Atlas Comprehensive End-to-End Test Suite
=========================================================
Tests the complete application against live MongoDB Atlas when DATABASE_BACKEND=mongodb.
Verifies all 9 domains without relying on SQLite.
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.security import create_access_token


@pytest.fixture(scope="module")
def mongo_env():
    """Ensure DATABASE_BACKEND is set to mongodb for the test module."""
    original_backend = settings.DATABASE_BACKEND
    settings.DATABASE_BACKEND = "mongodb"
    yield
    settings.DATABASE_BACKEND = original_backend


@pytest.fixture(scope="module")
def mongo_client(mongo_env):
    """Provide TestClient operating in mongodb mode."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def student_token():
    return create_access_token(subject="user-student-arjun", role="STUDENT")


@pytest.fixture
def student_headers(student_token):
    return {"Authorization": f"Bearer {student_token}"}


@pytest.fixture
def vendor_token():
    return create_access_token(subject="user-vendor", role="VENDOR")


@pytest.fixture
def vendor_headers(vendor_token):
    return {"Authorization": f"Bearer {vendor_token}"}


@pytest.fixture
def admin_token():
    return create_access_token(subject="user-admin", role="ADMIN")


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ==============================================================================
# 1. Menus Domain via MongoDB
# ==============================================================================

def test_mongo_get_published_menu(mongo_client):
    res = mongo_client.get("/api/v1/menus/published")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["status"] == "PUBLISHED"
    assert data["versionNumber"] == 1
    assert len(data["meals"]) == 28


def test_mongo_get_menu_for_meal(mongo_client):
    res = mongo_client.get("/api/v1/menus/meal?day=MONDAY&meal=BREAKFAST")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["dayOfWeek"] == "MONDAY"
    assert data["mealType"] == "BREAKFAST"
    dish_names = [d["name"] for d in data["dishes"]]
    assert len(dish_names) > 0


def test_mongo_get_menu_history(mongo_client):
    res = mongo_client.get("/api/v1/menus/history")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["versionNumber"] >= 1


# ==============================================================================
# 2. Meals Domain via MongoDB
# ==============================================================================

def test_mongo_get_all_meals(mongo_client):
    res = mongo_client.get("/api/v1/meals")
    assert res.status_code == status.HTTP_200_OK
    meals = res.json()
    assert len(meals) == 28
    assert all("id" in m and "mealDate" in m and "mealType" in m for m in meals)


def test_mongo_get_meal_by_id(mongo_client):
    res = mongo_client.get("/api/v1/meals/mi-2026-11-01-breakfast")
    assert res.status_code == status.HTTP_200_OK
    meal = res.json()
    assert meal["id"] == "mi-2026-11-01-breakfast"
    assert meal["mealDate"] == "2026-11-01"
    assert meal["mealType"] == "BREAKFAST"


def test_mongo_get_actionable_meal(mongo_client):
    res = mongo_client.get("/api/v1/meals/actionable")
    assert res.status_code == status.HTTP_200_OK


# ==============================================================================
# 3. Student Responses Domain via MongoDB
# ==============================================================================

def test_mongo_get_student_response(mongo_client, student_headers):
    res = mongo_client.get(
        "/api/v1/responses/my?mealInstanceId=mi-2026-11-01-breakfast",
        headers=student_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    if data:
        assert data["studentId"] == "user-student-arjun"
        assert data["mealInstanceId"] == "mi-2026-11-01-breakfast"


def test_mongo_get_aggregate_counts_strict_no_response(mongo_client, vendor_headers):
    res = mongo_client.get(
        "/api/v1/responses/counts/mi-2026-11-01-breakfast",
        headers=vendor_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    counts = res.json()
    assert counts["totalRegistered"] >= 3
    assert "noResponse" in counts
    assert "notEating" in counts
    assert "definitelyEating" in counts
    # Verify strict invariant: total = def + prob + not_eating + no_response
    total = (
        counts["definitelyEating"]
        + counts["probablyEating"]
        + counts["notEating"]
        + counts["noResponse"]
    )
    assert total == counts["totalRegistered"]


# ==============================================================================
# 4. Forecasts Domain via MongoDB
# ==============================================================================

def test_mongo_get_forecast_recommendation(mongo_client):
    res = mongo_client.get("/api/v1/forecasts/recommendation/mi-2026-11-01-breakfast")
    assert res.status_code == status.HTTP_200_OK
    rec = res.json()
    assert rec["mealInstanceId"] == "mi-2026-11-01-breakfast"
    assert rec["baselineAttendance"] >= 3
    assert rec["recommendedPortions"] >= 3
    assert rec["baselineAttendance"] != 700  # Dynamic active student population, not hardcoded 700


def test_mongo_get_vendor_decision(mongo_client):
    res = mongo_client.get("/api/v1/forecasts/decision/mi-2026-11-01-breakfast")
    assert res.status_code == status.HTTP_200_OK


# ==============================================================================
# 5. Meal Outcomes Domain via MongoDB
# ==============================================================================

def test_mongo_get_all_outcomes(mongo_client):
    res = mongo_client.get("/api/v1/outcomes")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert isinstance(data, list)


def test_mongo_get_specific_outcome(mongo_client):
    res = mongo_client.get("/api/v1/outcomes/mi-2026-11-01-breakfast")
    assert res.status_code == status.HTTP_200_OK


# ==============================================================================
# 6. Notification Schedules Domain via MongoDB
# ==============================================================================

def test_mongo_get_all_schedules(mongo_client):
    res = mongo_client.get("/api/v1/schedules")
    assert res.status_code == status.HTTP_200_OK
    schedules = res.json()
    assert len(schedules) == 28


def test_mongo_validate_schedules(mongo_client):
    res = mongo_client.get("/api/v1/schedules/validate")
    assert res.status_code == status.HTTP_200_OK
    val = res.json()
    assert "isValid" in val
    assert "errors" in val
    assert "warnings" in val


# ==============================================================================
# 7. Notifications Domain via MongoDB
# ==============================================================================

def test_mongo_get_notifications(mongo_client, student_headers):
    res = mongo_client.get("/api/v1/notifications", headers=student_headers)
    assert res.status_code == status.HTTP_200_OK
    notifs = res.json()
    assert isinstance(notifs, list)


def test_mongo_get_unread_count(mongo_client, student_headers):
    res = mongo_client.get("/api/v1/notifications/unread-count", headers=student_headers)
    assert res.status_code == status.HTTP_200_OK
    count = res.json()
    assert isinstance(count, int)
    assert count >= 0


# ==============================================================================
# 8. Reports Domain via MongoDB
# ==============================================================================

def test_mongo_get_dashboard_summary(mongo_client):
    res = mongo_client.get("/api/v1/reports/summary")
    assert res.status_code == status.HTTP_200_OK
    summary = res.json()
    assert summary["totalStudents"] >= 3
    assert summary["totalVendors"] == 1
    assert summary["totalAdmins"] == 1
    assert summary["configuredSchedules"] == 28
    assert summary["publishedMenuVersion"] == 1
    assert len(summary["upcomingDeadlines"]) > 0


def test_mongo_get_meal_reports(mongo_client):
    res = mongo_client.get("/api/v1/reports/meals?mealType=BREAKFAST")
    assert res.status_code == status.HTTP_200_OK
    reports = res.json()
    assert len(reports) > 0
    assert all(r["mealType"] == "BREAKFAST" for r in reports)
    for r in reports:
        assert "counts" in r
        assert r["counts"]["totalRegistered"] >= 3
