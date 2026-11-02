import pytest
from fastapi import status

def test_get_published_menu(client):
    res = client.get("/api/v1/menus/published")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["versionNumber"] == 1
    assert data["status"] == "PUBLISHED"
    assert len(data["meals"]) == 28

def test_get_menu_for_meal(client):
    res = client.get("/api/v1/menus/meal?day=MONDAY&meal=BREAKFAST")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["dayOfWeek"] == "MONDAY"
    assert data["mealType"] == "BREAKFAST"
    dish_names = [d["name"] for d in data["dishes"]]
    assert "Pongal" in dish_names
    assert "Boiled Egg" in dish_names

def test_draft_forbidden_for_student(client, student_auth_headers):
    res = client.post("/api/v1/menus/draft", headers=student_auth_headers, json={})
    assert res.status_code == status.HTTP_403_FORBIDDEN

def test_draft_forbidden_for_vendor(client, vendor_auth_headers):
    res = client.post("/api/v1/menus/draft", headers=vendor_auth_headers, json={})
    assert res.status_code == status.HTTP_403_FORBIDDEN

def test_admin_create_draft_and_publish(client, admin_auth_headers):
    # 1. No draft initially
    res = client.get("/api/v1/menus/draft", headers=admin_auth_headers)
    assert res.status_code == status.HTTP_404_NOT_FOUND

    # 2. Admin creates draft
    res = client.post("/api/v1/menus/draft", headers=admin_auth_headers, json={
        "change_summary": "Weekly menu revision draft"
    })
    assert res.status_code == status.HTTP_200_OK
    draft = res.json()
    assert draft["status"] == "DRAFT"
    assert draft["versionNumber"] == 2

    # 3. Admin publishes draft
    res = client.post("/api/v1/menus/publish", headers=admin_auth_headers, json={
        "change_summary": "Promoted draft to version 2"
    })
    assert res.status_code == status.HTTP_200_OK
    published = res.json()
    assert published["status"] == "PUBLISHED"
    assert published["versionNumber"] == 2

    # 4. History now has 2 versions
    res = client.get("/api/v1/menus/history", headers=admin_auth_headers)
    assert res.status_code == status.HTTP_200_OK
    history = res.json()
    assert len(history) >= 2
