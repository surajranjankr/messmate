"""
MessMate Timezone Consistency & Operational Authority Test Suite
================================================================
Validates all 11 requirements from institution-settings-consistency-audit:
1. IST date before midnight.
2. IST date after midnight while UTC is still on the previous day.
3. Meal identification at 2:00 AM IST.
4. Correct response deadline before and after expiry.
5. UTC persistence and timezone conversion.
6. Notification scheduling across local midnight.
7. Report boundaries.
8. Invalid timezone configuration.
9. SQLite/MongoDB parity.
10. Changing timezone and observing changed operational dates.
11. Existing historical outcomes remaining unchanged.
"""

from datetime import datetime, date, time, timezone, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import patch
import pytest
from fastapi import status

from app.core.timezone import (
    validate_timezone_name,
    get_institution_timezone,
    get_institution_today_str,
    parse_as_aware,
    to_utc,
    local_date_and_time_to_utc,
    get_utc_interval_for_local_date,
)
from app.models.setting import InstitutionSetting
from app.models.meal import MealInstance
from app.models.schedule import NotificationSchedule
from app.models.outcome import MealOutcome
from app.models.response import MealResponse
from app.repositories.sqlite.meal import SqliteMealRepository
from app.repositories.mongodb.meal import MongoMealRepository


# --- 1 & 2: IST date before vs after midnight relative to UTC ---
def test_ist_date_before_and_after_midnight():
    kolkata_tz = ZoneInfo("Asia/Kolkata")

    # 1. Before midnight: 23:30 IST on Nov 3 is 18:00 UTC on Nov 3
    dt_before_utc = datetime(2026, 11, 3, 18, 0, 0, tzinfo=timezone.utc)
    dt_before_ist = dt_before_utc.astimezone(kolkata_tz)
    assert dt_before_ist.hour == 23 and dt_before_ist.minute == 30
    assert dt_before_utc.strftime("%Y-%m-%d") == "2026-11-03"
    assert dt_before_ist.strftime("%Y-%m-%d") == "2026-11-03"

    # 2. After midnight: 02:00 IST on Nov 4 is 20:30 UTC on Nov 3
    dt_after_utc = datetime(2026, 11, 3, 20, 30, 0, tzinfo=timezone.utc)
    dt_after_ist = dt_after_utc.astimezone(kolkata_tz)
    assert dt_after_ist.hour == 2 and dt_after_ist.minute == 0
    # UTC is still Nov 3, but institution local date is Nov 4!
    assert dt_after_utc.strftime("%Y-%m-%d") == "2026-11-03"
    assert dt_after_ist.strftime("%Y-%m-%d") == "2026-11-04"


# --- 3: Meal identification at 2:00 AM IST ---
@pytest.mark.asyncio
async def test_meal_identification_at_2am_ist(db_session):
    # Ensure meals exist for Nov 3 and Nov 4
    db_session.merge(MealInstance(
        id="mi-tz-test-nov3",
        meal_date="2026-11-03",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline="2026-11-03T09:30:00+05:30",
        status="COMPLETED"
    ))
    db_session.merge(MealInstance(
        id="mi-tz-test-nov4",
        meal_date="2026-11-04",
        meal_type="BREAKFAST",
        menu_version_id="menu-v1",
        response_deadline="2026-11-03T22:00:00+05:30",
        status="RESPONSE_OPEN"
    ))
    db_session.commit()

    repo = SqliteMealRepository(db_session)

    # Freeze time to 20:30 UTC on Nov 3 (= 2:00 AM IST on Nov 4)
    freeze_at_2am_ist = datetime(2026, 11, 4, 2, 0, 0, tzinfo=ZoneInfo("Asia/Kolkata"))

    with patch("app.core.timezone.datetime") as mock_core_dt, \
         patch("app.repositories.sqlite.meal.datetime") as mock_dt:
        mock_core_dt.now.side_effect = lambda tz=None: (
            freeze_at_2am_ist.astimezone(tz) if tz else freeze_at_2am_ist
        )
        mock_core_dt.fromisoformat = datetime.fromisoformat
        mock_core_dt.combine = datetime.combine
        mock_dt.now.side_effect = lambda tz=None: (
            freeze_at_2am_ist.astimezone(tz) if tz else freeze_at_2am_ist
        )
        mock_dt.fromisoformat = datetime.fromisoformat

        today_meals = await repo.get_today()
        assert len(today_meals) >= 1
        # All returned meals must strictly have meal_date == "2026-11-04"
        assert all(m.meal_date == "2026-11-04" for m in today_meals)
        assert any(m.id == "mi-tz-test-nov4" for m in today_meals)


# --- 4: Correct response deadline before and after expiry ---
def test_response_deadline_validation(client, student_auth_headers, db_session):
    # Set up meal instance with deadline at 2026-11-04 10:00:00 IST
    # 10:00:00 IST = 04:30:00 UTC
    db_session.merge(MealInstance(
        id="mi-deadline-test",
        meal_date="2026-11-04",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline="2026-11-04T10:00:00+05:30",
        status="RESPONSE_OPEN"
    ))
    db_session.commit()

    # 1. Before deadline: 09:30 IST (= 04:00 UTC)
    instant_before = datetime(2026, 11, 4, 4, 0, 0, tzinfo=timezone.utc)
    with patch("app.api.routes.responses.datetime") as mock_dt:
        mock_dt.now.return_value = instant_before
        mock_dt.fromisoformat = datetime.fromisoformat

        res = client.post(
            "/api/v1/responses?mealInstanceId=mi-deadline-test",
            json={"choice": "DEFINITELY_EATING"},
            headers=student_auth_headers,
        )
        assert res.status_code == status.HTTP_200_OK

    # 2. After deadline: 10:05 IST (= 04:35 UTC)
    instant_after = datetime(2026, 11, 4, 4, 35, 0, tzinfo=timezone.utc)
    with patch("app.api.routes.responses.datetime") as mock_dt:
        mock_dt.now.return_value = instant_after
        mock_dt.fromisoformat = datetime.fromisoformat

        res = client.post(
            "/api/v1/responses?mealInstanceId=mi-deadline-test",
            json={"choice": "NOT_EATING"},
            headers=student_auth_headers,
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "deadline for this meal has passed" in res.json()["detail"]


# --- 5: UTC persistence and timezone conversion ---
def test_utc_persistence_and_timezone_conversion():
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    ny_tz = ZoneInfo("America/New_York")

    # Local meal preparation at 10:00 PM IST
    dt_local = datetime(2026, 11, 4, 22, 0, 0, tzinfo=kolkata_tz)
    dt_utc = to_utc(dt_local)

    # UTC must be 16:30
    assert dt_utc.tzinfo == timezone.utc
    assert dt_utc.hour == 16 and dt_utc.minute == 30

    # Cross-timezone representation in New York (EDT/EST)
    dt_ny = dt_utc.astimezone(ny_tz)
    assert dt_ny.strftime("%Y-%m-%d") == "2026-11-04"

    # Naive string parsing uses institution default
    parsed = parse_as_aware("2026-11-04T22:00:00", default_tz="Asia/Kolkata")
    assert parsed.tzinfo == kolkata_tz
    assert to_utc(parsed) == dt_utc


# --- 6: Notification scheduling across local midnight ---
def test_notification_scheduling_across_local_midnight():
    kolkata_tz = ZoneInfo("Asia/Kolkata")

    # Breakfast notification is offset = 1 (send 21:00 day before, deadline 22:00 day before)
    # For meal date 2026-11-05, notification target date is 2026-11-04 21:00 IST
    send_utc = local_date_and_time_to_utc("2026-11-04", "21:00", kolkata_tz)
    deadline_utc = local_date_and_time_to_utc("2026-11-04", "22:00", kolkata_tz)

    assert send_utc.hour == 15 and send_utc.minute == 30
    assert deadline_utc.hour == 16 and deadline_utc.minute == 30
    assert send_utc < deadline_utc


# --- 7: Report boundaries in institution timezone ---
def test_report_boundaries_in_institution_timezone():
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    start_utc, end_utc = get_utc_interval_for_local_date("2026-11-04", kolkata_tz)

    # Nov 4 00:00:00 IST = Nov 3 18:30:00 UTC
    assert start_utc == datetime(2026, 11, 3, 18, 30, 0, tzinfo=timezone.utc)
    # Nov 4 23:59:59.999999 IST = Nov 4 18:29:59.999999 UTC
    assert end_utc.day == 4 and end_utc.hour == 18 and end_utc.minute == 29


# --- 8: Invalid timezone configuration produces 422 ---
def test_invalid_timezone_configuration_rejected(client, admin_auth_headers):
    # Invalid zone string
    res = client.put(
        "/api/v1/settings",
        json={"timezone": "Invalid/MadeUp_Zone"},
        headers=admin_auth_headers,
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "Invalid IANA timezone name" in res.text

    # Empty zone string
    res = client.put(
        "/api/v1/settings",
        json={"timezone": "   "},
        headers=admin_auth_headers,
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# --- 9: SQLite and MongoDB Parity for get_today ---
@pytest.mark.asyncio
async def test_sqlite_and_mongodb_parity_for_today(db_session):
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    freeze_at_2am_ist = datetime(2026, 11, 4, 2, 0, 0, tzinfo=kolkata_tz)

    # 1. SQLite side
    db_session.merge(MealInstance(
        id="mi-tz-parity-lunch",
        meal_date="2026-11-04",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline="2026-11-04T09:30:00+05:30",
        status="RESPONSE_OPEN"
    ))
    db_session.commit()
    sqlite_repo = SqliteMealRepository(db_session)

    # 2. Mock MongoDB collection
    mongo_docs = [
        {
            "_id": "mi-tz-parity-lunch",
            "meal_date": "2026-11-04",
            "meal_type": "LUNCH",
            "menu_version_id": "menu-v1",
            "response_deadline": "2026-11-04T09:30:00+05:30",
            "status": "RESPONSE_OPEN",
        }
    ]

    class FakeCursor:
        def __init__(self, data):
            self.data = data
        async def to_list(self, length=100):
            return self.data

    class FakeCollection:
        def __init__(self, docs):
            self.docs = docs
        def find(self, query):
            filtered = [d for d in self.docs if d.get("meal_date") == query.get("meal_date")]
            return FakeCursor(filtered)
        async def update_one(self, *args, **kwargs):
            pass

    class FakeDB:
        name = "messmate_test"
        def __init__(self, docs):
            self.meal_instances = FakeCollection(docs)
            self.institution_settings = self
        async def find_one(self, query):
            return {"_id": "default", "timezone": "Asia/Kolkata"}

    mongo_repo = MongoMealRepository(FakeDB(mongo_docs))

    with patch("app.core.timezone.datetime") as mock_core_dt, \
         patch("app.repositories.sqlite.meal.datetime") as mock_sq_dt, \
         patch("app.repositories.mongodb.meal.datetime") as mock_mg_dt:
        mock_core_dt.now.side_effect = lambda tz=None: (
            freeze_at_2am_ist.astimezone(tz) if tz else freeze_at_2am_ist
        )
        mock_core_dt.fromisoformat = datetime.fromisoformat
        mock_core_dt.combine = datetime.combine
        mock_sq_dt.now.side_effect = lambda tz=None: (
            freeze_at_2am_ist.astimezone(tz) if tz else freeze_at_2am_ist
        )
        mock_sq_dt.fromisoformat = datetime.fromisoformat
        mock_mg_dt.now.side_effect = lambda tz=None: (
            freeze_at_2am_ist.astimezone(tz) if tz else freeze_at_2am_ist
        )
        mock_mg_dt.fromisoformat = datetime.fromisoformat

        sq_today = await sqlite_repo.get_today()
        mg_today = await mongo_repo.get_today()

        assert any(m.id == "mi-tz-parity-lunch" for m in sq_today)
        assert any(m.id == "mi-tz-parity-lunch" for m in mg_today)
        assert all(m.meal_date == "2026-11-04" for m in sq_today)
        assert all(m.meal_date == "2026-11-04" for m in mg_today)


# --- 10: Changing timezone and observing changed operational dates ---
@pytest.mark.asyncio
async def test_changing_timezone_changes_operational_today(client, admin_auth_headers, db_session):
    # Set up meal for Nov 4 and Nov 3
    db_session.merge(MealInstance(
        id="mi-tz-nov3-test",
        meal_date="2026-11-03",
        meal_type="DINNER",
        menu_version_id="menu-v1",
        response_deadline="2026-11-03T17:00:00+05:30",
        status="RESPONSE_OPEN"
    ))
    db_session.merge(MealInstance(
        id="mi-tz-nov4-test",
        meal_date="2026-11-04",
        meal_type="BREAKFAST",
        menu_version_id="menu-v1",
        response_deadline="2026-11-04T08:00:00+05:30",
        status="RESPONSE_OPEN"
    ))
    db_session.commit()

    repo = SqliteMealRepository(db_session)

    # Instant is 20:30 UTC on Nov 3 (= 02:00 IST on Nov 4 = 15:30 EST on Nov 3)
    frozen_instant = datetime(2026, 11, 3, 20, 30, 0, tzinfo=timezone.utc)

    with patch("app.core.timezone.datetime") as mock_core_dt, \
         patch("app.repositories.sqlite.meal.datetime") as mock_dt:
        mock_core_dt.now.side_effect = lambda tz=None: (
            frozen_instant.astimezone(tz) if tz else frozen_instant
        )
        mock_core_dt.fromisoformat = datetime.fromisoformat
        mock_core_dt.combine = datetime.combine
        mock_dt.now.side_effect = lambda tz=None: (
            frozen_instant.astimezone(tz) if tz else frozen_instant
        )
        mock_dt.fromisoformat = datetime.fromisoformat

        # 1. Under Asia/Kolkata: operational date is Nov 4
        client.put("/api/v1/settings", json={"timezone": "Asia/Kolkata"}, headers=admin_auth_headers)
        today_kolkata = await repo.get_today()
        assert any(m.id == "mi-tz-nov4-test" for m in today_kolkata)
        assert all(m.meal_date == "2026-11-04" for m in today_kolkata)

        # 2. Change timezone to America/New_York: operational date becomes Nov 3!
        client.put("/api/v1/settings", json={"timezone": "America/New_York"}, headers=admin_auth_headers)
        today_ny = await repo.get_today()
        assert any(m.id == "mi-tz-nov3-test" for m in today_ny)
        assert all(m.meal_date == "2026-11-03" for m in today_ny)

        # 3. Restore to Asia/Kolkata
        client.put("/api/v1/settings", json={"timezone": "Asia/Kolkata"}, headers=admin_auth_headers)


# --- 11: Existing historical outcomes remain unchanged ---
def test_historical_outcomes_remain_unchanged_on_timezone_update(client, admin_auth_headers, db_session):
    # Ensure parent meal instance exists first
    db_session.merge(MealInstance(
        id="mi-tz-hist-meal",
        meal_date="2026-10-20",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline="2026-10-20T09:30:00+05:30",
        status="COMPLETED"
    ))
    db_session.merge(MealOutcome(
        meal_instance_id="mi-tz-hist-meal",
        actual_attendance=250,
        actual_prepared_quantity=260,
        prepared_unit="portions",
        leftover_quantity=10.5,
        leftover_unit="kg",
        notes="Historical record before timezone change",
        recorded_at=datetime(2026, 10, 20, 14, 0, 0, tzinfo=timezone.utc)
    ))
    db_session.commit()

    # Change timezone
    res = client.put(
        "/api/v1/settings",
        json={"timezone": "UTC"},
        headers=admin_auth_headers,
    )
    assert res.status_code == status.HTTP_200_OK

    # Query outcome
    outcome = db_session.query(MealOutcome).filter(MealOutcome.meal_instance_id == "mi-tz-hist-meal").first()
    assert outcome.actual_attendance == 250
    assert outcome.actual_prepared_quantity == 260
    assert outcome.leftover_quantity == 10.5
    assert outcome.leftover_unit == "kg"
    assert outcome.notes == "Historical record before timezone change"

    # Restore timezone
    client.put("/api/v1/settings", json={"timezone": "Asia/Kolkata"}, headers=admin_auth_headers)
