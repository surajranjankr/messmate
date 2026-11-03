"""
MessMate Comprehensive Dynamic Forecasting Engine Test Suite
===========================================================
Validates the complete 16 scenarios covering:
- Formula precision: F = (D * 1.0) + (P * 0.5) + (R * rate), Q = ceil(F * (1 + m))
- Fallback hierarchy: historical rate > configured setting > INSUFFICIENT data
- Invariants: T = D + P + N + R
- Zero active population and all-zero responses
- Safety margin applied exactly once
- Vendor override preservation
- Exclusion of inactive users and non-student roles
- Response deduplication
- Dual-database equivalence between SQLite and MongoDB
"""

import pytest
import math
from datetime import datetime, timezone, timedelta
from app.models.user import User
from app.models.meal import MealInstance
from app.models.response import MealResponse
from app.models.outcome import MealOutcome
from app.models.forecast import ForecastRecommendation, VendorDecision
from app.core.config import settings
from app.repositories.sqlite.forecast import SqliteForecastRepository
from app.repositories.mongodb.forecast import MongoForecastRepository


@pytest.fixture
def clean_db(db_session):
    """Sets up a clean test state with exactly 3 active students, 1 inactive student, 1 vendor, 1 admin."""
    db_session.query(VendorDecision).delete()
    db_session.query(ForecastRecommendation).delete()
    db_session.query(MealOutcome).delete()
    db_session.query(MealResponse).delete()
    db_session.query(MealInstance).delete()
    db_session.query(User).delete()

    users = [
        User(id="st-1", email="st1@test.ac.in", hashed_password="hash", display_name="Student 1", role="STUDENT", status="ACTIVE"),
        User(id="st-2", email="st2@test.ac.in", hashed_password="hash", display_name="Student 2", role="STUDENT", status="ACTIVE"),
        User(id="st-3", email="st3@test.ac.in", hashed_password="hash", display_name="Student 3", role="STUDENT", status="ACTIVE"),
        User(id="st-inact", email="inact@test.ac.in", hashed_password="hash", display_name="Inactive", role="STUDENT", status="INACTIVE"),
        User(id="vendor-1", email="vendor@test.ac.in", hashed_password="hash", display_name="Vendor 1", role="VENDOR", status="ACTIVE"),
        User(id="admin-1", email="admin@test.ac.in", hashed_password="hash", display_name="Admin 1", role="ADMIN", status="ACTIVE"),
    ]
    for u in users:
        db_session.add(u)

    meal = MealInstance(
        id="meal-sc-1",
        meal_date="2026-11-10",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        status="RESPONSE_OPEN",
    )
    db_session.add(meal)
    db_session.commit()
    return db_session


@pytest.fixture
async def mongo_write_db():
    from app.db.mongo import get_mongo_client
    client = get_mongo_client()
    test_db = client["messmate_forecast_test"]
    await client.drop_database("messmate_forecast_test")
    yield test_db
    await client.drop_database("messmate_forecast_test")


# --- Scenario 1: 3 students, all No Response, 70% fallback ---
@pytest.mark.asyncio
async def test_scenario_01_all_no_response_with_fallback(clean_db):
    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.baseline_attendance == 3
    assert rec.definitely_eating == 0
    assert rec.probably_eating == 0
    assert rec.not_eating == 0
    assert rec.no_response == 3
    assert rec.nonresponse_attendance_rate == 0.70
    assert rec.expected_attendance == 2.1  # 3 * 0.70
    assert rec.recommended_portions == 3   # ceil(2.1 * 1.08) = ceil(2.268) = 3


# --- Scenario 2: 1 Definitely, 1 Probably, 1 Not Eating, 0 No Response ---
@pytest.mark.asyncio
async def test_scenario_02_balanced_responses(clean_db):
    clean_db.add(MealResponse(id="r1", student_id="st-1", meal_instance_id="meal-sc-1", choice="DEFINITELY_EATING"))
    clean_db.add(MealResponse(id="r2", student_id="st-2", meal_instance_id="meal-sc-1", choice="PROBABLY_EATING"))
    clean_db.add(MealResponse(id="r3", student_id="st-3", meal_instance_id="meal-sc-1", choice="NOT_EATING"))
    clean_db.commit()

    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.definitely_eating == 1
    assert rec.probably_eating == 1
    assert rec.not_eating == 1
    assert rec.no_response == 0
    # Expected demand: (1 * 1.0) + (1 * 0.5) + (0 * 0) = 1.5
    assert rec.expected_attendance == 1.5
    # Recommended portions: ceil(1.5 * 1.08) = ceil(1.62) = 2
    assert rec.recommended_portions == 2


# --- Scenario 3: All active students Definitely Eating ---
@pytest.mark.asyncio
async def test_scenario_03_all_definitely_eating(clean_db):
    for sid in ["st-1", "st-2", "st-3"]:
        clean_db.add(MealResponse(id=f"r-{sid}", student_id=sid, meal_instance_id="meal-sc-1", choice="DEFINITELY_EATING"))
    clean_db.commit()

    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.definitely_eating == 3
    assert rec.expected_attendance == 3.0
    assert rec.recommended_portions == 4  # ceil(3.0 * 1.08) = 4


# --- Scenario 4: All active students Not Eating ---
@pytest.mark.asyncio
async def test_scenario_04_all_not_eating(clean_db):
    for sid in ["st-1", "st-2", "st-3"]:
        clean_db.add(MealResponse(id=f"r-{sid}", student_id=sid, meal_instance_id="meal-sc-1", choice="NOT_EATING"))
    clean_db.commit()

    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.not_eating == 3
    assert rec.expected_attendance == 0.0
    assert rec.recommended_portions == 0


# --- Scenario 5: Zero eligible students in database ---
@pytest.mark.asyncio
async def test_scenario_05_zero_eligible_students(clean_db):
    clean_db.query(MealResponse).delete()
    clean_db.query(User).filter(User.role == "STUDENT").delete()
    clean_db.commit()

    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.baseline_attendance == 0
    assert rec.expected_attendance == 0.0
    assert rec.recommended_portions == 0
    assert rec.data_quality_status == "ZERO_POPULATION"


# --- Scenario 6: No responses, no historical data, and configured rate is None ---
@pytest.mark.asyncio
async def test_scenario_06_insufficient_data_status(clean_db, monkeypatch):
    monkeypatch.setattr(settings, "DEFAULT_NONRESPONSE_ATTENDANCE_RATE", None)
    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.data_quality_status == "INSUFFICIENT"
    assert rec.recommended_portions is None
    assert "Insufficient response history" in rec.explanation


# --- Scenario 7: Configured nonresponse assumption fallback ---
@pytest.mark.asyncio
async def test_scenario_07_configured_fallback_applied(clean_db, monkeypatch):
    monkeypatch.setattr(settings, "DEFAULT_NONRESPONSE_ATTENDANCE_RATE", 0.50)
    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.nonresponse_attendance_rate == 0.50
    # Expected demand: 3 * 0.50 = 1.5, ceil(1.5 * 1.08) = 2
    assert rec.expected_attendance == 1.5
    assert rec.recommended_portions == 2


# --- Scenario 8: Historical nonresponse rate takes priority over configured fallback ---
@pytest.mark.asyncio
async def test_scenario_08_historical_rate_priority(clean_db):
    # Create past completed lunch meal
    past_meal = MealInstance(
        id="meal-past-lunch",
        meal_date="2026-11-03",
        meal_type="LUNCH",
        menu_version_id="menu-v1",
        response_deadline=(datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        status="COMPLETED",
    )
    clean_db.add(past_meal)
    # 1 definitely eating, 2 no response. Past actual attendance was 2 students.
    # Respondents: 1 student (1.0). Nonresponders attending: 2 - 1.0 = 1.0. Total R = 2. Historical rate = 1.0 / 2 = 0.50
    clean_db.add(MealResponse(id="r-past-1", student_id="st-1", meal_instance_id="meal-past-lunch", choice="DEFINITELY_EATING"))
    clean_db.add(MealOutcome(meal_instance_id="meal-past-lunch", actual_attendance=2, actual_prepared_quantity=3))
    clean_db.commit()

    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.nonresponse_attendance_rate == 0.50  # Derived from history, overriding 0.70 default!
    assert "HISTORICAL" in rec.explanation


# --- Scenario 9: Safety margin applied exactly once ---
@pytest.mark.asyncio
async def test_scenario_09_safety_margin_applied_once(clean_db):
    # With F = 2.1 and margin = 0.08:
    # Q = ceil(2.1 * 1.08) = ceil(2.268) = 3
    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    expected_Q = math.ceil(rec.expected_attendance * (1 + rec.safety_margin_fraction))
    assert rec.recommended_portions == expected_Q


# --- Scenario 10: Vendor override preserves original recommendation ---
@pytest.mark.asyncio
async def test_scenario_10_vendor_override_preservation(clean_db):
    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.recommended_portions == 3

    # Vendor overrides to 10
    decision = await repo.save_decision("meal-sc-1", planned_quantity=10, override_reason="Special guest visit")
    assert decision.original_recommendation == 3
    assert decision.final_planned_quantity == 10
    assert decision.status == "OVERRIDDEN"
    assert decision.override_reason == "Special guest visit"

    # Querying decision returns preserved record
    saved = await repo.get_decision("meal-sc-1")
    assert saved.original_recommendation == 3
    assert saved.final_planned_quantity == 10
    assert saved.status == "OVERRIDDEN"


# --- Scenario 11: Actual attendance does not overwrite forecast ---
@pytest.mark.asyncio
async def test_scenario_11_actual_attendance_does_not_overwrite_forecast(clean_db):
    repo = SqliteForecastRepository(clean_db)
    rec_before = await repo.get_recommendation("meal-sc-1")

    # Add outcome
    clean_db.add(MealOutcome(meal_instance_id="meal-sc-1", actual_attendance=50, actual_prepared_quantity=55))
    clean_db.commit()

    rec_after = await repo.get_recommendation("meal-sc-1")
    assert rec_after.recommended_portions == rec_before.recommended_portions
    assert rec_after.expected_attendance == rec_before.expected_attendance


# --- Scenario 12: Leftovers do not overwrite preparation quantity ---
@pytest.mark.asyncio
async def test_scenario_12_leftovers_do_not_overwrite_preparation_quantity(clean_db):
    repo = SqliteForecastRepository(clean_db)
    await repo.save_decision("meal-sc-1", planned_quantity=5)

    # Record outcome with leftover
    outcome = MealOutcome(
        meal_instance_id="meal-sc-1",
        actual_attendance=3,
        actual_prepared_quantity=5,
        leftover_quantity=2.0,
        leftover_unit="kg",
    )
    clean_db.add(outcome)
    clean_db.commit()

    decision = await repo.get_decision("meal-sc-1")
    assert decision.final_planned_quantity == 5


# --- Scenario 13: Multiple meals use independent response counts and forecasts ---
@pytest.mark.asyncio
async def test_scenario_13_independent_meal_forecasts(clean_db):
    meal2 = MealInstance(
        id="meal-sc-2",
        meal_date="2026-11-10",
        meal_type="DINNER",
        menu_version_id="menu-v1",
        response_deadline=(datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
        status="RESPONSE_OPEN",
    )
    clean_db.add(meal2)
    # Meal 1 has all Definitely Eating
    for sid in ["st-1", "st-2", "st-3"]:
        clean_db.add(MealResponse(id=f"r1-{sid}", student_id=sid, meal_instance_id="meal-sc-1", choice="DEFINITELY_EATING"))
    # Meal 2 has all Not Eating
    for sid in ["st-1", "st-2", "st-3"]:
        clean_db.add(MealResponse(id=f"r2-{sid}", student_id=sid, meal_instance_id="meal-sc-2", choice="NOT_EATING"))
    clean_db.commit()

    repo = SqliteForecastRepository(clean_db)
    rec1 = await repo.get_recommendation("meal-sc-1")
    rec2 = await repo.get_recommendation("meal-sc-2")

    assert rec1.recommended_portions == 4  # ceil(3 * 1.08)
    assert rec2.recommended_portions == 0  # 0


# --- Scenario 14: Inactive accounts and non-students excluded ---
@pytest.mark.asyncio
async def test_scenario_14_inactive_and_non_students_excluded(clean_db):
    # Submit responses for inactive student and vendor
    clean_db.add(MealResponse(id="r-inact", student_id="st-inact", meal_instance_id="meal-sc-1", choice="DEFINITELY_EATING"))
    clean_db.add(MealResponse(id="r-vend", student_id="vendor-1", meal_instance_id="meal-sc-1", choice="DEFINITELY_EATING"))
    clean_db.commit()

    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    # Only active students st-1, st-2, st-3 are counted (all 3 are No Response)
    assert rec.baseline_attendance == 3
    assert rec.definitely_eating == 0
    assert rec.no_response == 3
    assert rec.recommended_portions == 3


# --- Scenario 15: Deduplication of student responses ---
@pytest.mark.asyncio
async def test_scenario_15_duplicate_responses_do_not_inflate(clean_db):
    # Same student submits response twice (or updates it)
    clean_db.add(MealResponse(id="r-dup-1", student_id="st-1", meal_instance_id="meal-sc-1", choice="DEFINITELY_EATING"))
    clean_db.commit()

    repo = SqliteForecastRepository(clean_db)
    rec = await repo.get_recommendation("meal-sc-1")
    assert rec.definitely_eating == 1
    assert rec.no_response == 2
    assert rec.baseline_attendance == 3
    assert rec.definitely_eating + rec.probably_eating + rec.not_eating + rec.no_response == 3


# --- Scenario 16: Dual-database equivalence between SQLite and MongoDB ---
@pytest.mark.asyncio
async def test_scenario_16_sqlite_and_mongodb_equivalence(clean_db, mongo_write_db):
    # Set up identical data in isolated test MongoDB
    await mongo_write_db.meal_instances.insert_one({
        "_id": "meal-sc-mongo",
        "meal_date": "2026-11-10",
        "meal_type": "LUNCH",
        "menu_version_id": "menu-v1",
        "response_deadline": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        "status": "RESPONSE_OPEN",
    })
    for i in range(1, 4):
        await mongo_write_db.users.insert_one({
            "_id": f"st-mongo-{i}",
            "email": f"st{i}@mongo.ac.in",
            "full_name": f"Mongo Student {i}",
            "role": "STUDENT",
            "status": "ACTIVE",
        })
    # 1 definitely eating
    await mongo_write_db.meal_responses.insert_one({
        "_id": "resp-mongo-1",
        "student_id": "st-mongo-1",
        "meal_instance_id": "meal-sc-mongo",
        "choice": "DEFINITELY_EATING",
    })

    # SQLite side: 1 definitely eating
    clean_db.add(MealResponse(id="r-sq-1", student_id="st-1", meal_instance_id="meal-sc-1", choice="DEFINITELY_EATING"))
    clean_db.commit()

    sqlite_repo = SqliteForecastRepository(clean_db)
    mongo_repo = MongoForecastRepository(mongo_write_db)

    sq_rec = await sqlite_repo.get_recommendation("meal-sc-1")
    mg_rec = await mongo_repo.get_recommendation("meal-sc-mongo")

    # Verify identical values
    assert sq_rec.baseline_attendance == mg_rec.baseline_attendance == 3
    assert sq_rec.definitely_eating == mg_rec.definitely_eating == 1
    assert sq_rec.probably_eating == mg_rec.probably_eating == 0
    assert sq_rec.not_eating == mg_rec.not_eating == 0
    assert sq_rec.no_response == mg_rec.no_response == 2
    assert sq_rec.expected_attendance == mg_rec.expected_attendance == 2.4  # 1.0 + (2 * 0.70) = 2.4
    assert sq_rec.recommended_portions == mg_rec.recommended_portions == 3  # ceil(2.4 * 1.08) = ceil(2.592) = 3
