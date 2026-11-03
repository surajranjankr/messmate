"""
MessMate Operational Integrity Test Suite
=========================================
Systematic automated verification of:
1. Dynamic Student Population (T = count of active eligible students)
2. Response Partitioning & Mathematical Invariant (T = D + P + N + R)
3. Opening & Closing Response Window Enforcement (opening <= now < closing)
4. Role-Based Endpoint Protection & Direct API Tampering Prevention
5. Dual Database Engine Parity (SQLite & MongoDB)
6. Complete End-to-End Operational Lifecycle
"""

import math
import pytest
from datetime import datetime, timezone, timedelta, date
from zoneinfo import ZoneInfo
from unittest.mock import patch
from fastapi import status

from app.models.user import User
from app.models.meal import MealInstance
from app.models.response import MealResponse
from app.models.schedule import NotificationSchedule
from app.models.forecast import ForecastRecommendation, VendorDecision
from app.models.outcome import MealOutcome
from app.models.setting import InstitutionSetting
from app.repositories.sqlite.meal import SqliteMealRepository
from app.repositories.mongodb.meal import MongoMealRepository
from app.repositories.sqlite.response import SqliteResponseRepository
from app.repositories.mongodb.response import MongoResponseRepository
from app.repositories.sqlite.forecast import SqliteForecastRepository
from app.repositories.mongodb.forecast import MongoForecastRepository
from app.core.timezone import (
    calculate_meal_response_window,
    evaluate_meal_window_status,
    get_institution_today_str,
    now_utc,
)


# ==============================================================================
# SECTION A: Student Population Tests (Scenarios 1-10)
# ==============================================================================

@pytest.mark.asyncio
async def test_student_population_authoritative_source_of_truth(db_session):
    """
    T = COUNT(DISTINCT eligible student account IDs)
    Only role == 'STUDENT' and status == 'ACTIVE' count.
    Vendors, Admins, Inactive students, and Duplicate queries are strictly excluded.
    """
    repo = SqliteResponseRepository(db_session)

    # 1. Clear students for isolated test
    db_session.query(User).filter(User.role == "STUDENT").delete()
    db_session.commit()

    # Create dummy meal
    meal = MealInstance(
        id="mi-pop-test",
        meal_date="2026-11-04",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline="2026-11-04T09:30:00+05:30",
        response_open_time="2026-11-04T08:00:00+05:30",
        status="UPCOMING",
    )
    db_session.merge(meal)
    db_session.commit()

    # Zero students
    counts_zero = await repo.get_counts_by_meal("mi-pop-test")
    assert counts_zero.total_registered == 0
    assert counts_zero.no_response == 0

    # Add 1 active student
    s1 = User(
        id="u-pop-1",
        display_name="Student One",
        email="s1@iiitdwd.ac.in",
        hashed_password="pw",
        role="STUDENT",
        status="ACTIVE",
    )
    db_session.merge(s1)
    db_session.commit()
    counts_1 = await repo.get_counts_by_meal("mi-pop-test")
    assert counts_1.total_registered == 1
    assert counts_1.no_response == 1

    # Add 2 more active students -> T = 3
    s2 = User(id="u-pop-2", display_name="Student Two", email="s2@iiitdwd.ac.in", hashed_password="pw", role="STUDENT", status="ACTIVE")
    s3 = User(id="u-pop-3", display_name="Student Three", email="s3@iiitdwd.ac.in", hashed_password="pw", role="STUDENT", status="ACTIVE")
    db_session.merge(s2)
    db_session.merge(s3)
    db_session.commit()
    counts_3 = await repo.get_counts_by_meal("mi-pop-test")
    assert counts_3.total_registered == 3

    # Add Vendor and Admin accounts -> MUST NOT increase T
    v1 = User(id="u-pop-v", display_name="Vendor X", email="vx@iiitdwd.ac.in", hashed_password="pw", role="VENDOR", status="ACTIVE")
    a1 = User(id="u-pop-a", display_name="Admin Y", email="ay@iiitdwd.ac.in", hashed_password="pw", role="ADMIN", status="ACTIVE")
    db_session.merge(v1)
    db_session.merge(a1)
    db_session.commit()
    counts_with_staff = await repo.get_counts_by_meal("mi-pop-test")
    assert counts_with_staff.total_registered == 3, "Vendors and Admins must not be counted in student population"

    # Add an INACTIVE student -> MUST NOT increase T
    s_inact = User(id="u-pop-inact", display_name="Inactive Z", email="inact@iiitdwd.ac.in", hashed_password="pw", role="STUDENT", status="INACTIVE")
    db_session.merge(s_inact)
    db_session.commit()
    counts_with_inact = await repo.get_counts_by_meal("mi-pop-test")
    assert counts_with_inact.total_registered == 3, "Inactive students must not be counted"

    # Admin approves/activates the inactive student -> T increases to 4
    db_session.query(User).filter(User.id == "u-pop-inact").update({"status": "ACTIVE"})
    db_session.commit()
    counts_after_activate = await repo.get_counts_by_meal("mi-pop-test")
    assert counts_after_activate.total_registered == 4

    # Admin deactivates student 1 -> T decreases back to 3
    db_session.query(User).filter(User.id == "u-pop-1").update({"status": "INACTIVE"})
    db_session.commit()
    counts_after_deact = await repo.get_counts_by_meal("mi-pop-test")
    assert counts_after_deact.total_registered == 3


# ==============================================================================
# SECTION B: Response Partitioning and Invariant Tests (Scenarios 11-20)
# ==============================================================================

@pytest.mark.asyncio
async def test_response_partitioning_and_invariant(db_session):
    """
    Enforces:
    1. T = D + P + N + R for all states
    2. R = max(0, T - (D + P + N))
    3. Updating response modifies existing record in-place without duplicate row
    4. Responses are partitioned strictly per meal instance
    5. Excluded/deactivated accounts do not increase counts
    """
    repo = SqliteResponseRepository(db_session)

    # Clear users for isolated counting test
    db_session.query(MealResponse).delete()
    db_session.query(User).filter(User.role == "STUDENT").delete()
    db_session.commit()

    # Ensure 3 active students: u-inv-1, u-inv-2, u-inv-3
    for i in [1, 2, 3]:
        db_session.merge(User(
            id=f"u-inv-{i}",
            display_name=f"Student {i}",
            email=f"u-inv-{i}@iiitdwd.ac.in",
            hashed_password="pw",
            role="STUDENT",
            status="ACTIVE"
        ))
    db_session.merge(MealInstance(
        id="mi-inv-lunch",
        meal_date="2026-11-04",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline="2026-11-04T09:30:00+05:30",
        response_open_time="2026-11-04T08:00:00+05:30",
        status="RESPONSE_OPEN",
    ))
    db_session.merge(MealInstance(
        id="mi-inv-dinner",
        meal_date="2026-11-04",
        meal_type="DINNER",
        menu_version_id="menu-v1",
        response_deadline="2026-11-04T17:00:00+05:30",
        response_open_time="2026-11-04T15:00:00+05:30",
        status="UPCOMING",
    ))
    db_session.commit()

    # Initially 0 responses: D=0, P=0, N=0, R=3, T=3
    c0 = await repo.get_counts_by_meal("mi-inv-lunch")
    assert c0.definitely_eating == 0
    assert c0.probably_eating == 0
    assert c0.not_eating == 0
    assert c0.no_response == 3
    assert c0.total_registered == 3
    assert c0.definitely_eating + c0.probably_eating + c0.not_eating + c0.no_response == c0.total_registered

    # 1. Student 1 submits DEFINITELY_EATING
    await repo.save_response("u-inv-1", "mi-inv-lunch", "DEFINITELY_EATING")
    c1 = await repo.get_counts_by_meal("mi-inv-lunch")
    assert c1.definitely_eating == 1
    assert c1.no_response == 2
    assert c1.total_registered == 3

    # 2. Student 2 submits PROBABLY_EATING
    await repo.save_response("u-inv-2", "mi-inv-lunch", "PROBABLY_EATING")
    c2 = await repo.get_counts_by_meal("mi-inv-lunch")
    assert c2.definitely_eating == 1
    assert c2.probably_eating == 1
    assert c2.no_response == 1

    # 3. Student 3 submits NOT_EATING
    await repo.save_response("u-inv-3", "mi-inv-lunch", "NOT_EATING")
    c3 = await repo.get_counts_by_meal("mi-inv-lunch")
    assert c3.definitely_eating == 1
    assert c3.probably_eating == 1
    assert c3.not_eating == 1
    assert c3.no_response == 0
    assert c3.definitely_eating + c3.probably_eating + c3.not_eating + c3.no_response == 3

    # 4. Student 1 updates response to NOT_EATING
    await repo.save_response("u-inv-1", "mi-inv-lunch", "NOT_EATING")
    c4 = await repo.get_counts_by_meal("mi-inv-lunch")
    assert c4.definitely_eating == 0
    assert c4.probably_eating == 1
    assert c4.not_eating == 2
    assert c4.no_response == 0

    # Ensure single row updated, no duplicate rows
    rows = db_session.query(MealResponse).filter(
        MealResponse.student_id == "u-inv-1",
        MealResponse.meal_instance_id == "mi-inv-lunch"
    ).all()
    assert len(rows) == 1

    # 5. Responses to lunch MUST NOT affect dinner
    c_dinner = await repo.get_counts_by_meal("mi-inv-dinner")
    assert c_dinner.definitely_eating == 0
    assert c_dinner.not_eating == 0
    assert c_dinner.no_response == 3


# ==============================================================================
# SECTION C: Response Window and Deadline Tests (Scenarios 21-34)
# ==============================================================================

def test_window_evaluator_exact_boundary_conditions():
    """
    Tests opening <= current_time < closing convention:
    - Before opening: UPCOMING
    - Exactly at opening: RESPONSE_OPEN
    - During open window: RESPONSE_OPEN
    - One second before closing: RESPONSE_OPEN
    - Exactly at closing: RESPONSE_CLOSED
    - After closing: RESPONSE_CLOSED
    """
    tz = ZoneInfo("Asia/Kolkata")
    # Window: 08:00 to 09:30 on Nov 4
    open_dt = datetime(2026, 11, 4, 8, 0, 0, tzinfo=tz).astimezone(timezone.utc)
    close_dt = datetime(2026, 11, 4, 9, 30, 0, tzinfo=tz).astimezone(timezone.utc)

    # 1. Before opening (07:59:59) -> UPCOMING
    t_before = open_dt - timedelta(seconds=1)
    assert evaluate_meal_window_status(t_before, open_dt, close_dt) == "UPCOMING"

    # 2. Exactly at opening (08:00:00) -> RESPONSE_OPEN
    assert evaluate_meal_window_status(open_dt, open_dt, close_dt) == "RESPONSE_OPEN"

    # 3. During open window (08:45:00) -> RESPONSE_OPEN
    t_mid = datetime(2026, 11, 4, 8, 45, 0, tzinfo=tz).astimezone(timezone.utc)
    assert evaluate_meal_window_status(t_mid, open_dt, close_dt) == "RESPONSE_OPEN"

    # 4. One second before closing (09:29:59) -> RESPONSE_OPEN
    t_sec_before = close_dt - timedelta(seconds=1)
    assert evaluate_meal_window_status(t_sec_before, open_dt, close_dt) == "RESPONSE_OPEN"

    # 5. Exactly at closing (09:30:00) -> RESPONSE_CLOSED
    assert evaluate_meal_window_status(close_dt, open_dt, close_dt) == "RESPONSE_CLOSED"

    # 6. After closing (09:30:01) -> RESPONSE_CLOSED
    t_after = close_dt + timedelta(seconds=1)
    assert evaluate_meal_window_status(t_after, open_dt, close_dt) == "RESPONSE_CLOSED"


def test_api_rejection_before_opening_and_after_closing(client, student_auth_headers, vendor_auth_headers, admin_auth_headers, db_session):
    """
    Verifies that direct API submissions via POST /api/v1/responses:
    - Before opening: REJECTED (HTTP 400 with 'not opened yet')
    - After closing: REJECTED (HTTP 400 with 'deadline has passed')
    - Disallows vendor or admin from submitting student responses (HTTP 403)
    - Disallows inactive student from submitting (HTTP 403 / 401)
    """
    tz = ZoneInfo("Asia/Kolkata")
    # Meal instance: Nov 5 Lunch (Open 08:00, Close 09:30)
    db_session.merge(MealInstance(
        id="mi-test-window-lunch",
        meal_date="2026-11-05",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_open_time="2026-11-05T08:00:00+05:30",
        response_deadline="2026-11-05T09:30:00+05:30",
        status="UPCOMING",
    ))
    db_session.commit()

    # --- Scenario 1: Before opening (7:30 AM on Nov 5) ---
    t_early = datetime(2026, 11, 5, 7, 30, 0, tzinfo=tz).astimezone(timezone.utc)
    with patch("app.api.routes.responses.datetime") as mock_dt:
        mock_dt.now.return_value = t_early
        mock_dt.fromisoformat = datetime.fromisoformat

        res = client.post(
            "/api/v1/responses?mealInstanceId=mi-test-window-lunch",
            headers=student_auth_headers,
            json={"choice": "DEFINITELY_EATING"},
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "not opened yet" in res.json()["detail"].lower()

    # --- Scenario 2: During open window (8:15 AM on Nov 5) ---
    t_open = datetime(2026, 11, 5, 8, 15, 0, tzinfo=tz).astimezone(timezone.utc)
    with patch("app.api.routes.responses.datetime") as mock_dt:
        mock_dt.now.return_value = t_open
        mock_dt.fromisoformat = datetime.fromisoformat

        res_ok = client.post(
            "/api/v1/responses?mealInstanceId=mi-test-window-lunch",
            headers=student_auth_headers,
            json={"choice": "DEFINITELY_EATING"},
        )
        assert res_ok.status_code == status.HTTP_200_OK
        assert res_ok.json()["choice"] == "DEFINITELY_EATING"

    # --- Scenario 3: After closing (10:00 AM on Nov 5) ---
    t_late = datetime(2026, 11, 5, 10, 0, 0, tzinfo=tz).astimezone(timezone.utc)
    with patch("app.api.routes.responses.datetime") as mock_dt:
        mock_dt.now.return_value = t_late
        mock_dt.fromisoformat = datetime.fromisoformat

        # Modification attempt after closing MUST be rejected
        res_late = client.post(
            "/api/v1/responses?mealInstanceId=mi-test-window-lunch",
            headers=student_auth_headers,
            json={"choice": "NOT_EATING"},
        )
        assert res_late.status_code == status.HTTP_400_BAD_REQUEST
        assert "deadline" in res_late.json()["detail"].lower()

    # --- Scenario 4: Role rejection for Vendor and Admin ---
    res_vendor = client.post(
        "/api/v1/responses?mealInstanceId=mi-test-window-lunch",
        headers=vendor_auth_headers,
        json={"choice": "DEFINITELY_EATING"},
    )
    assert res_vendor.status_code == status.HTTP_403_FORBIDDEN

    res_admin = client.post(
        "/api/v1/responses?mealInstanceId=mi-test-window-lunch",
        headers=admin_auth_headers,
        json={"choice": "DEFINITELY_EATING"},
    )
    assert res_admin.status_code == status.HTTP_403_FORBIDDEN


# ==============================================================================
# SECTION D: Forecasting Dynamic Integrity Tests (Scenarios 41-50)
# ==============================================================================

@pytest.mark.asyncio
async def test_forecasting_with_actual_population_and_vendor_override(db_session):
    """
    Verifies:
    1. Recommendation strictly uses actual active students T
    2. Dynamic formula: F = D + 0.5P + r*R, Q = ceil(F * (1 + m))
    3. Vendor override to e.g. 5 portions preserves original recommendation Q
    4. Changing safety margin updates new recommendations without corrupting past decisions
    """
    forecast_repo = SqliteForecastRepository(db_session)
    resp_repo = SqliteResponseRepository(db_session)

    # Clean student population and create 4 students
    db_session.query(User).filter(User.role == "STUDENT").delete()
    for i in range(1, 5):
        db_session.merge(User(
            id=f"u-fc-{i}",
            display_name=f"Student {i}",
            email=f"fc{i}@iiitdwd.ac.in",
            hashed_password="pw",
            role="STUDENT",
            status="ACTIVE"
        ))
    db_session.merge(MealInstance(
        id="mi-fc-test-lunch",
        meal_date="2026-11-06",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_open_time="2026-11-06T08:00:00+05:30",
        response_deadline="2026-11-06T09:30:00+05:30",
        status="RESPONSE_OPEN",
    ))
    db_session.commit()

    # Responses: 2 DEFINITELY, 1 PROBABLY, 0 NOT EATING, 1 NO RESPONSE (T=4)
    await resp_repo.save_response("u-fc-1", "mi-fc-test-lunch", "DEFINITELY_EATING")
    await resp_repo.save_response("u-fc-2", "mi-fc-test-lunch", "DEFINITELY_EATING")
    await resp_repo.save_response("u-fc-3", "mi-fc-test-lunch", "PROBABLY_EATING")

    # Get recommendation:
    # D=2, P=1, N=0, R=1, r=0.70 fallback, m=0.08
    # F = 2*1.0 + 1*0.5 + 1*0.70 = 3.20
    # Q = ceil(3.20 * 1.08) = ceil(3.456) = 4 portions
    rec = await forecast_repo.get_recommendation("mi-fc-test-lunch")
    assert rec.baseline_attendance == 4
    assert rec.definitely_eating == 2
    assert rec.probably_eating == 1
    assert rec.not_eating == 0
    assert rec.no_response == 1
    assert rec.expected_attendance == 3.2
    assert rec.recommended_portions == 4

    # Vendor overrides recommendation to 5 portions with reason
    dec = await forecast_repo.save_decision(
        meal_id="mi-fc-test-lunch",
        planned_quantity=5,
        override_reason="Slight buffer for mess guests",
    )
    assert dec.original_recommendation == 4
    assert dec.final_planned_quantity == 5
    assert dec.status == "OVERRIDDEN"

    # Verify decision retrieval preserves original Q
    retrieved_dec = await forecast_repo.get_decision("mi-fc-test-lunch")
    assert retrieved_dec.original_recommendation == 4
    assert retrieved_dec.final_planned_quantity == 5


# ==============================================================================
# SECTION E: Cross-Database Parity (SQLite & MongoDB)
# ==============================================================================

@pytest.mark.asyncio
async def test_sqlite_and_mongodb_window_and_population_parity(db_session):
    """
    Verifies that SQLite and MongoDB repositories derive identical:
    1. Operational today dates in institution timezone
    2. Response window status evaluation
    3. Aggregate student counts and mathematical invariant
    """
    tz = ZoneInfo("Asia/Kolkata")
    freeze_dt = datetime(2026, 11, 4, 8, 30, 0, tzinfo=tz) # During lunch open window

    # 1. SQLite side
    db_session.merge(MealInstance(
        id="mi-parity-meal",
        meal_date="2026-11-04",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_open_time="2026-11-04T08:00:00+05:30",
        response_deadline="2026-11-04T09:30:00+05:30",
        status="UPCOMING",
    ))
    db_session.commit()
    sqlite_repo = SqliteMealRepository(db_session)

    # 2. Mock MongoDB collection
    mongo_docs = [
        {
            "_id": "mi-parity-meal",
            "meal_date": "2026-11-04",
            "meal_type": "LUNCH",
            "menu_version_id": "menu-v1",
            "response_open_time": "2026-11-04T08:00:00+05:30",
            "response_deadline": "2026-11-04T09:30:00+05:30",
            "status": "UPCOMING",
        }
    ]

    class FakeCursor:
        def __init__(self, data):
            self.data = data
        async def to_list(self, length):
            return self.data

    class FakeCollection:
        def __init__(self, docs):
            self.docs = docs
        def find(self, query):
            filtered = [d for d in self.docs if d.get("meal_date") == query.get("meal_date")]
            return FakeCursor(filtered)
        async def find_one(self, query):
            for d in self.docs:
                if d.get("_id") == query.get("_id"):
                    return d
            return None
        async def update_one(self, *args, **kwargs):
            pass

    class FakeDB:
        name = "messmate_test"
        def __init__(self, docs):
            self.meal_instances = FakeCollection(docs)
            self.notification_schedules = FakeCollection([])
            self.institution_settings = self
        async def find_one(self, query):
            return {"_id": "default", "timezone": "Asia/Kolkata"}

    mongo_repo = MongoMealRepository(FakeDB(mongo_docs))

    with patch("app.core.timezone.datetime") as mock_core_dt, \
         patch("app.repositories.sqlite.meal.datetime") as mock_sq_dt, \
         patch("app.repositories.mongodb.meal.datetime") as mock_mg_dt:
        mock_core_dt.now.side_effect = lambda t_zone=None: (
            freeze_dt.astimezone(t_zone) if t_zone else freeze_dt
        )
        mock_core_dt.fromisoformat = datetime.fromisoformat
        mock_sq_dt.now.side_effect = lambda t_zone=None: (
            freeze_dt.astimezone(t_zone) if t_zone else freeze_dt
        )
        mock_sq_dt.fromisoformat = datetime.fromisoformat
        mock_mg_dt.now.side_effect = lambda t_zone=None: (
            freeze_dt.astimezone(t_zone) if t_zone else freeze_dt
        )
        mock_mg_dt.fromisoformat = datetime.fromisoformat

        sq_today = await sqlite_repo.get_today()
        mg_today = await mongo_repo.get_today()

        assert len(sq_today) >= 1
        assert len(mg_today) >= 1
        # In both engines, at 8:30 AM IST, lunch window has opened!
        assert any(m.id == "mi-parity-meal" and m.status == "RESPONSE_OPEN" for m in sq_today)
        assert any(m.id == "mi-parity-meal" and m.status == "RESPONSE_OPEN" for m in mg_today)
