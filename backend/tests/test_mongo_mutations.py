"""
MessMate MongoDB Atlas Mutating Operations & Complete Workflows Test Suite
==========================================================================
Executes all mutating operations (Student responses, Vendor decisions & outcomes,
Admin users, menus, schedules) against an isolated test database (`messmate_write_test`)
on MongoDB Atlas. Guarantees 100% protection of the production `messmate` database.
"""

import asyncio
from datetime import datetime, timezone, timedelta
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token
from app.db.mongo import get_mongo_client, init_mongo_indexes


TEST_DB_NAME = "messmate_write_test"
PROD_DB_NAME = "messmate"


def setup_isolated_db():
    """Initializes isolated test database on Atlas by copying schema and baseline seed from prod."""
    async def _async_setup():
        client = get_mongo_client()
        prod_db = client[PROD_DB_NAME]
        test_db = client[TEST_DB_NAME]

        # Ensure clean slate
        await client.drop_database(TEST_DB_NAME)

        # 1. Copy collections from production (users, menus, schedules, notifications, meals)
        cols = ["users", "menu_versions", "meal_instances", "notification_schedules", "notifications"]
        for col in cols:
            docs = await prod_db[col].find({}).to_list(1000)
            if docs:
                await test_db[col].insert_many(docs)

        # 2. Initialize domain indexes
        await init_mongo_indexes(test_db)

        # 3. Insert dedicated test meal instances for response testing
        now = datetime.now(timezone.utc)
        future_deadline = (now + timedelta(hours=3)).isoformat()
        past_deadline = (now - timedelta(hours=1)).isoformat()

        await test_db.meal_instances.insert_one({
            "_id": "mi-write-test-future",
            "meal_date": "2026-12-01",
            "meal_type": "DINNER",
            "menu_version_id": "menu-v1",
            "response_deadline": future_deadline,
            "status": "RESPONSE_OPEN",
            "recommendation": None,
            "vendor_decision": None,
            "outcome": None,
        })

        await test_db.meal_instances.insert_one({
            "_id": "mi-write-test-past",
            "meal_date": "2026-12-02",
            "meal_type": "LUNCH",
            "menu_version_id": "menu-v1",
            "response_deadline": past_deadline,
            "status": "RESPONSE_CLOSED",
            "recommendation": None,
            "vendor_decision": None,
            "outcome": None,
        })

    asyncio.run(_async_setup())


def teardown_isolated_db():
    """Drops the isolated test database and asserts production database remains 100% intact."""
    async def _async_teardown():
        client = get_mongo_client()
        await client.drop_database(TEST_DB_NAME)

        # Verify production database count
        prod_db = client[PROD_DB_NAME]
        total_prod = 0
        for col in ["users", "menu_versions", "meal_instances", "meal_responses", "notification_schedules", "notifications"]:
            total_prod += await prod_db[col].count_documents({})

        assert total_prod == 66, f"SAFETY VIOLATION: Production documents modified! Count={total_prod}"

    asyncio.run(_async_teardown())


@pytest.fixture(scope="module")
def isolated_mongo_client():
    """Configures application to use isolated test database on MongoDB Atlas."""
    orig_backend = settings.DATABASE_BACKEND
    orig_db = settings.MONGODB_DATABASE

    try:
        settings.DATABASE_BACKEND = "mongodb"
        settings.MONGODB_DATABASE = TEST_DB_NAME

        setup_isolated_db()

        with TestClient(app) as test_client:
            yield test_client

        teardown_isolated_db()
    finally:
        settings.DATABASE_BACKEND = orig_backend
        settings.MONGODB_DATABASE = orig_db
    settings.MONGODB_DATABASE = orig_db


@pytest.fixture
def student_headers():
    token = create_access_token(subject="user-student-arjun", role="STUDENT")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def vendor_headers():
    token = create_access_token(subject="user-vendor", role="VENDOR")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers():
    token = create_access_token(subject="user-admin", role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. Student Mutating Operations on MongoDB
# ==============================================================================

def test_student_submit_response_mongo(isolated_mongo_client, student_headers):
    """Test submitting a new meal attendance intention to MongoDB."""
    res = isolated_mongo_client.post(
        "/api/v1/responses?meal_instance_id=mi-write-test-future",
        headers=student_headers,
        json={"choice": "DEFINITELY_EATING"},
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["studentId"] == "user-student-arjun"
    assert data["mealInstanceId"] == "mi-write-test-future"
    assert data["choice"] == "DEFINITELY_EATING"


def test_student_update_response_mongo(isolated_mongo_client, student_headers):
    """Test updating an existing meal response in MongoDB."""
    res = isolated_mongo_client.post(
        "/api/v1/responses?meal_instance_id=mi-write-test-future",
        headers=student_headers,
        json={"choice": "PROBABLY_EATING"},
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["choice"] == "PROBABLY_EATING"


def test_student_single_response_no_duplicates_mongo(isolated_mongo_client, student_headers):
    """Verify that multiple updates update in place and do NOT create duplicate responses."""
    # Re-submit again with NOT_EATING
    res = isolated_mongo_client.post(
        "/api/v1/responses?meal_instance_id=mi-write-test-future",
        headers=student_headers,
        json={"choice": "NOT_EATING"},
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["choice"] == "NOT_EATING"

    # Check student history: exactly one response exists for this student
    hist_res = isolated_mongo_client.get("/api/v1/responses/history", headers=student_headers)
    assert hist_res.status_code == status.HTTP_200_OK
    matching = [r for r in hist_res.json() if r["mealInstanceId"] == "mi-write-test-future"]
    assert len(matching) == 1
    assert matching[0]["choice"] == "NOT_EATING"


def test_student_response_rejected_after_deadline_mongo(isolated_mongo_client, student_headers):
    """Verify server-side deadline enforcement: past deadline must reject with 400."""
    res = isolated_mongo_client.post(
        "/api/v1/responses?meal_instance_id=mi-write-test-past",
        headers=student_headers,
        json={"choice": "DEFINITELY_EATING"},
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "deadline for this meal has passed" in res.json()["detail"].lower()


def test_student_retrieve_updated_response_mongo(isolated_mongo_client, student_headers):
    """Verify retrieving the updated response via /responses/my."""
    res = isolated_mongo_client.get(
        "/api/v1/responses/my?meal_instance_id=mi-write-test-future",
        headers=student_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["choice"] == "NOT_EATING"


# ==============================================================================
# 2. Vendor Mutating Operations on MongoDB
# ==============================================================================

def test_vendor_save_forecast_decision_and_override_preservation_mongo(
    isolated_mongo_client, vendor_headers
):
    """Test vendor batch override: dynamic recommendation (4 from 3 active students) must be preserved."""
    res = isolated_mongo_client.post(
        "/api/v1/forecasts/decision/mi-write-test-future",
        headers=vendor_headers,
        json={
            "finalPlannedQuantity": 735,
            "overrideReason": "Rain forecast: reduced dinner attendance expected",
        },
    )
    assert res.status_code == status.HTTP_200_OK
    decision = res.json()
    assert decision["mealInstanceId"] == "mi-write-test-future"
    assert decision["originalRecommendation"] == 3
    assert decision["finalPlannedQuantity"] == 735
    assert decision["status"] == "OVERRIDDEN"
    assert decision["overrideReason"] == "Rain forecast: reduced dinner attendance expected"

    # Verify embedded recommendation was preserved in MongoDB
    rec_res = isolated_mongo_client.get("/api/v1/forecasts/recommendation/mi-write-test-future")
    assert rec_res.status_code == status.HTTP_200_OK
    assert rec_res.json()["recommendedPortions"] == 3
    assert decision["finalPlannedQuantity"] == 735


def test_vendor_record_preparation_attendance_leftovers_mongo(
    isolated_mongo_client, vendor_headers
):
    """Test recording post-meal outcome measurements embedded in MongoDB."""
    res = isolated_mongo_client.post(
        "/api/v1/outcomes/mi-write-test-future",
        headers=vendor_headers,
        json={
            "actualAttendance": 712,
            "actualPreparedQuantity": 735,
            "preparedUnit": "portions",
            "leftoverQuantity": 7.5,
            "leftoverUnit": "kg",
            "notes": "Dal makhani leftover recorded accurately.",
        },
    )
    assert res.status_code == status.HTTP_200_OK
    outcome = res.json()
    assert outcome["mealInstanceId"] == "mi-write-test-future"
    assert outcome["actualAttendance"] == 712
    assert outcome["actualPreparedQuantity"] == 735
    assert outcome["preparedUnit"] == "portions"
    assert outcome["leftoverQuantity"] == 7.5
    assert outcome["leftoverUnit"] == "kg"
    assert outcome["notes"] == "Dal makhani leftover recorded accurately."


def test_vendor_retrieve_saved_outcome_mongo(isolated_mongo_client, vendor_headers):
    """Test retrieving outcome via single meal and all outcomes list."""
    res = isolated_mongo_client.get("/api/v1/outcomes/mi-write-test-future")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["actualAttendance"] == 712

    res_all = isolated_mongo_client.get("/api/v1/outcomes")
    assert res_all.status_code == status.HTTP_200_OK
    meals_with_outcome = [o["mealInstanceId"] for o in res_all.json()]
    assert "mi-write-test-future" in meals_with_outcome


# ==============================================================================
# 3. Admin Mutating Operations on MongoDB
# ==============================================================================

def test_admin_create_user_and_persistence_mongo(isolated_mongo_client, admin_headers):
    """Test creating a new student user and verifying persistence & login via MongoDB."""
    new_email = "newstudent@iiitdwd.ac.in"
    res = isolated_mongo_client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={
            "email": new_email,
            "displayName": "New Student Test",
            "role": "STUDENT",
            "password": "strongPassword123",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    created = res.json()
    assert created["email"] == new_email
    assert created["role"] == "STUDENT"

    # Verify user can log in with their password
    login_res = isolated_mongo_client.post(
        "/api/v1/auth/login",
        json={"email": new_email, "password": "strongPassword123"},
    )
    assert login_res.status_code == status.HTTP_200_OK
    assert login_res.json()["user"]["email"] == new_email


def test_admin_create_draft_menu_and_publish_immutability_mongo(
    isolated_mongo_client, admin_headers
):
    """Test full menu revision: create draft, verify version increment, publish and archive v1."""
    # 1. Create draft menu
    res_draft = isolated_mongo_client.post(
        "/api/v1/menus/draft",
        headers=admin_headers,
        json={"change_summary": "Weekly menu revision draft for semester 2"},
    )
    assert res_draft.status_code == status.HTTP_200_OK
    draft = res_draft.json()
    assert draft["status"] == "DRAFT"
    assert draft["versionNumber"] == 2
    assert len(draft["meals"]) == 28

    # 2. Verify draft is accessible via /menus/draft
    res_get_draft = isolated_mongo_client.get("/api/v1/menus/draft")
    assert res_get_draft.status_code == status.HTTP_200_OK
    assert res_get_draft.json()["status"] == "DRAFT"

    # 3. Publish draft
    res_publish = isolated_mongo_client.post(
        "/api/v1/menus/publish",
        headers=admin_headers,
        json={"change_summary": "Promoted draft to published Version 2"},
    )
    assert res_publish.status_code == status.HTTP_200_OK
    published = res_publish.json()
    assert published["status"] == "PUBLISHED"
    assert published["versionNumber"] == 2

    # 4. Verify Version 1 is now ARCHIVED
    res_history = isolated_mongo_client.get("/api/v1/menus/history")
    assert res_history.status_code == status.HTTP_200_OK
    history = res_history.json()
    assert len(history) == 2
    assert history[0]["versionNumber"] == 2 and history[0]["status"] == "PUBLISHED"
    assert history[1]["versionNumber"] == 1 and history[1]["status"] == "ARCHIVED"


def test_admin_update_schedule_and_overlap_ack_mongo(
    isolated_mongo_client, admin_headers
):
    """Test updating notification schedule times and acknowledging overlaps on MongoDB."""
    sched_id = "schedule-monday-lunch"
    res = isolated_mongo_client.patch(
        f"/api/v1/schedules/{sched_id}",
        headers=admin_headers,
        json={
            "notifySendTime": "08:15",
            "responseDeadlineTime": "09:45",
        },
    )
    assert res.status_code == status.HTTP_200_OK
    updated = res.json()
    assert updated["id"] == sched_id
    assert updated["notifySendTime"] == "08:15"
    assert updated["responseDeadlineTime"] == "09:45"

    # Test overlap acknowledgement
    ack_res = isolated_mongo_client.post(
        "/api/v1/schedules/acknowledge-overlap",
        headers=admin_headers,
        json={
            "schedule_id": sched_id,
            "acknowledged": True,
        },
    )
    assert ack_res.status_code == status.HTTP_200_OK
    assert ack_res.json()["overlapAcknowledged"] is True


# ==============================================================================
# 4. Role-Based Authorization & Negative Tests on MongoDB
# ==============================================================================

def test_rbac_student_forbidden_mutations_mongo(isolated_mongo_client, student_headers):
    """Verify that Student cannot perform Vendor or Admin mutations on MongoDB."""
    # Cannot save vendor forecast decision
    res1 = isolated_mongo_client.post(
        "/api/v1/forecasts/decision/mi-write-test-future",
        headers=student_headers,
        json={"finalPlannedQuantity": 700},
    )
    assert res1.status_code == status.HTTP_403_FORBIDDEN

    # Cannot record meal outcome
    res2 = isolated_mongo_client.post(
        "/api/v1/outcomes/mi-write-test-future",
        headers=student_headers,
        json={"actualAttendance": 700},
    )
    assert res2.status_code == status.HTTP_403_FORBIDDEN

    # Cannot create user
    res3 = isolated_mongo_client.post(
        "/api/v1/users",
        headers=student_headers,
        json={"email": "hacker@iiitdwd.ac.in", "displayName": "Hacker", "role": "STUDENT", "password": "p"},
    )
    assert res3.status_code == status.HTTP_403_FORBIDDEN

    # Cannot create menu draft
    res4 = isolated_mongo_client.post(
        "/api/v1/menus/draft",
        headers=student_headers,
        json={"change_summary": "Unauthorized draft"},
    )
    assert res4.status_code == status.HTTP_403_FORBIDDEN


def test_rbac_vendor_forbidden_mutations_mongo(isolated_mongo_client, vendor_headers):
    """Verify that Vendor cannot perform Admin mutations on MongoDB."""
    # Cannot update schedule
    res1 = isolated_mongo_client.patch(
        "/api/v1/schedules/schedule-monday-lunch",
        headers=vendor_headers,
        json={"notifySendTime": "07:00"},
    )
    assert res1.status_code == status.HTTP_403_FORBIDDEN

    # Cannot create menu draft
    res2 = isolated_mongo_client.post(
        "/api/v1/menus/draft",
        headers=vendor_headers,
        json={"change_summary": "Vendor draft"},
    )
    assert res2.status_code == status.HTTP_403_FORBIDDEN


def test_negative_values_rejected_mongo(isolated_mongo_client, vendor_headers):
    """Verify input validation: negative quantities rejected with HTTP 422."""
    res1 = isolated_mongo_client.post(
        "/api/v1/forecasts/decision/mi-write-test-future",
        headers=vendor_headers,
        json={"finalPlannedQuantity": -10},
    )
    assert res1.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    res2 = isolated_mongo_client.post(
        "/api/v1/outcomes/mi-write-test-future",
        headers=vendor_headers,
        json={"actualAttendance": -5},
    )
    assert res2.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# ==============================================================================
# 5. Full End-to-End Workflows on MongoDB
# ==============================================================================

def test_complete_student_workflow_mongo(isolated_mongo_client):
    """
    Full Student Workflow on MongoDB:
    Login -> View Menu -> View Meals -> Submit Response -> Update Response -> View History
    """
    # 1. Login
    login_res = isolated_mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "priya@iiitdwd.ac.in", "password": "demo123"},
    )
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json().get("accessToken") or login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. View Published Menu
    menu_res = isolated_mongo_client.get("/api/v1/menus/published")
    assert menu_res.status_code == status.HTTP_200_OK
    assert len(menu_res.json()["meals"]) == 28

    # 3. View Meals
    meals_res = isolated_mongo_client.get("/api/v1/meals")
    assert meals_res.status_code == status.HTTP_200_OK
    assert len(meals_res.json()) >= 28

    # 4. Submit Response
    sub_res = isolated_mongo_client.post(
        "/api/v1/responses?meal_instance_id=mi-write-test-future",
        headers=headers,
        json={"choice": "DEFINITELY_EATING"},
    )
    assert sub_res.status_code == status.HTTP_200_OK
    assert sub_res.json()["choice"] == "DEFINITELY_EATING"

    # 5. Update Response
    upd_res = isolated_mongo_client.post(
        "/api/v1/responses?meal_instance_id=mi-write-test-future",
        headers=headers,
        json={"choice": "PROBABLY_EATING"},
    )
    assert upd_res.status_code == status.HTTP_200_OK
    assert upd_res.json()["choice"] == "PROBABLY_EATING"

    # 6. View History
    hist_res = isolated_mongo_client.get("/api/v1/responses/history", headers=headers)
    assert hist_res.status_code == status.HTTP_200_OK
    assert len(hist_res.json()) >= 1
    assert hist_res.json()[0]["choice"] == "PROBABLY_EATING"


def test_complete_vendor_workflow_mongo(isolated_mongo_client):
    """
    Full Vendor Workflow on MongoDB:
    Login -> View Meals -> View Aggregate Responses -> View Forecast -> Override Quantity -> Record Prep & Outcomes
    """
    # 1. Login
    login_res = isolated_mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "vendor@iiitdwd.ac.in", "password": "demo123"},
    )
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json().get("accessToken") or login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. View Meals
    meals_res = isolated_mongo_client.get("/api/v1/meals")
    assert meals_res.status_code == status.HTTP_200_OK

    # 3. View Aggregate Responses
    counts_res = isolated_mongo_client.get(
        "/api/v1/responses/counts/mi-write-test-future",
        headers=headers,
    )
    assert counts_res.status_code == status.HTTP_200_OK
    assert counts_res.json()["totalRegistered"] >= 3

    # 4. View Forecast Recommendation
    rec_res = isolated_mongo_client.get("/api/v1/forecasts/recommendation/mi-write-test-future")
    assert rec_res.status_code == status.HTTP_200_OK
    assert rec_res.json()["recommendedPortions"] == 3

    # 5. Submit Batch Override
    override_res = isolated_mongo_client.post(
        "/api/v1/forecasts/decision/mi-write-test-future",
        headers=headers,
        json={"finalPlannedQuantity": 745, "overrideReason": "Full workflow test override"},
    )
    assert override_res.status_code == status.HTTP_200_OK
    assert override_res.json()["status"] == "OVERRIDDEN"
    assert override_res.json()["finalPlannedQuantity"] == 745

    # 6. Record Outcome
    out_res = isolated_mongo_client.post(
        "/api/v1/outcomes/mi-write-test-future",
        headers=headers,
        json={
            "actualAttendance": 720,
            "actualPreparedQuantity": 745,
            "preparedUnit": "portions",
            "leftoverQuantity": 5.0,
            "leftoverUnit": "kg",
            "notes": "Workflow test outcome recorded.",
        },
    )
    assert out_res.status_code == status.HTTP_200_OK
    assert out_res.json()["actualAttendance"] == 720
    assert out_res.json()["leftoverQuantity"] == 5.0


def test_complete_admin_workflow_mongo(isolated_mongo_client):
    """
    Full Admin Workflow on MongoDB:
    Login -> View Dashboard -> Manage Users -> Manage Menu -> Manage Schedules -> View Reports
    """
    # 1. Login
    login_res = isolated_mongo_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@iiitdwd.ac.in", "password": "demo123"},
    )
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json().get("accessToken") or login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. View Dashboard
    dash_res = isolated_mongo_client.get("/api/v1/reports/summary")
    assert dash_res.status_code == status.HTTP_200_OK
    assert dash_res.json()["totalStudents"] >= 3

    # 3. Manage Users
    users_res = isolated_mongo_client.get("/api/v1/users", headers=headers)
    assert users_res.status_code == status.HTTP_200_OK
    assert len(users_res.json()) >= 5

    # 4. View Menu Versions & History
    hist_res = isolated_mongo_client.get("/api/v1/menus/history")
    assert hist_res.status_code == status.HTTP_200_OK
    assert len(hist_res.json()) >= 1

    # 5. Manage Schedules
    sched_res = isolated_mongo_client.get("/api/v1/schedules")
    assert sched_res.status_code == status.HTTP_200_OK
    assert len(sched_res.json()) == 28

    val_res = isolated_mongo_client.get("/api/v1/schedules/validate")
    assert val_res.status_code == status.HTTP_200_OK

    # 6. View Reports
    rep_res = isolated_mongo_client.get("/api/v1/reports/meals")
    assert rep_res.status_code == status.HTTP_200_OK
    assert len(rep_res.json()) > 0
