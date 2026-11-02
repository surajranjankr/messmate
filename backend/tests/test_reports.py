import pytest
from fastapi import status

def test_get_dashboard_summary(client, admin_auth_headers):
    res = client.get("/api/v1/reports/summary", headers=admin_auth_headers)
    assert res.status_code == status.HTTP_200_OK
    summary = res.json()
    assert summary["totalStudents"] >= 3
    assert summary["totalVendors"] >= 1
    assert summary["totalAdmins"] >= 1
    assert summary["configuredSchedules"] == 28
    assert summary["publishedMenuVersion"] == 1

def test_get_meal_reports_with_filter(client, admin_auth_headers):
    res = client.get("/api/v1/reports/meals?meal_type=LUNCH", headers=admin_auth_headers)
    assert res.status_code == status.HTTP_200_OK
    meals = res.json()
    assert isinstance(meals, list)
    for m in meals:
        assert m["mealType"] == "LUNCH"
        assert "counts" in m
        assert "definitelyEating" in m["counts"]
        assert "noResponse" in m["counts"]
