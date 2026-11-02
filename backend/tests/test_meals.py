import pytest
from fastapi import status

def test_get_all_meals(client):
    res = client.get("/api/v1/meals")
    assert res.status_code == status.HTTP_200_OK
    meals = res.json()
    assert len(meals) > 0
    assert "mealType" in meals[0]
    assert "responseDeadline" in meals[0]

def test_get_today_meals(client):
    res = client.get("/api/v1/meals/today")
    assert res.status_code == status.HTTP_200_OK
    meals = res.json()
    assert len(meals) == 4
    meal_types = {m["mealType"] for m in meals}
    assert meal_types == {"BREAKFAST", "LUNCH", "SNACKS", "DINNER"}

def test_get_actionable_meal(client):
    res = client.get("/api/v1/meals/actionable")
    assert res.status_code == status.HTTP_200_OK
    actionable = res.json()
    assert actionable is not None
    assert "id" in actionable
    assert "mealType" in actionable

def test_get_meal_by_id(client):
    # First get today's meals to pick an ID
    res = client.get("/api/v1/meals/today")
    today_meal = res.json()[0]
    meal_id = today_meal["id"]

    res_single = client.get(f"/api/v1/meals/{meal_id}")
    assert res_single.status_code == status.HTTP_200_OK
    assert res_single.json()["id"] == meal_id

def test_get_nonexistent_meal(client):
    res = client.get("/api/v1/meals/mi-9999-12-31-dinner")
    assert res.status_code == status.HTTP_404_NOT_FOUND
