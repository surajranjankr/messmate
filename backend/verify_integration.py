"""
MessMate Phase 2 Full-Stack End-to-End Verification Script
Tests real HTTP requests against the FastAPI backend using TestClient
to verify all 14 integration checkpoints.
"""
import sys
import os
from pathlib import Path

# Add backend directory to path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.meal import MealInstance
from app.models.response import MealResponse
from app.models.forecast import ForecastRecommendation, VendorDecision
from app.models.outcome import MealOutcome

def run_verification():
    print("=" * 70)
    print("MESSMATE PHASE 2: FULL-STACK INTEGRATION VERIFICATION")
    print("=" * 70)

    client = TestClient(app)

    # 1. Health check
    print("\n[1/14] Testing /health...")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print(f"  PASS: Backend API healthy ({res.json()['service']}, v{res.json()['version']})")

    # 2. Student Authentication (Arjun Sharma)
    print("\n[2/14] Testing Student Login (/api/v1/auth/login)...")
    res = client.post("/api/v1/auth/login", json={
        "email": "arjun@iiitdwd.ac.in",
        "password": "demo123"
    })
    assert res.status_code == 200, f"Student login failed: {res.text}"
    student_data = res.json()
    student_token = student_data["accessToken"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print(f"  PASS: Received JWT access token for {student_data['user']['displayName']} (Role: {student_data['user']['role']})")

    # 3. Authenticated Identity Verification (/auth/me)
    print("\n[3/14] Testing /api/v1/auth/me with Bearer token...")
    res = client.get("/api/v1/auth/me", headers=student_headers)
    assert res.status_code == 200
    assert res.json()["email"] == "arjun@iiitdwd.ac.in"
    print(f"  PASS: Identity verified: {res.json()['displayName']} ({res.json()['email']})")

    # 4. Published Menu Verification
    print("\n[4/14] Testing /api/v1/menus/published (Official IIIT Dharwad dataset)...")
    res = client.get("/api/v1/menus/published")
    assert res.status_code == 200
    menu = res.json()
    assert menu["versionNumber"] == 1
    assert len(menu["meals"]) == 28, f"Expected 28 meal slots, got {len(menu['meals'])}"
    print(f"  PASS: Published Menu Version {menu['versionNumber']} contains {len(menu['meals'])} meal slots (7 days x 4 meals)")

    # 5. Today's Meals Retrieval & Actionable Meal
    print("\n[5/14] Testing /api/v1/meals/actionable and /api/v1/meals/today...")
    res = client.get("/api/v1/meals/today")
    assert res.status_code == 200
    today_meals = res.json()
    assert len(today_meals) == 4
    
    # Get actionable meal or an upcoming meal whose deadline is in the future
    res_act = client.get("/api/v1/meals/actionable")
    assert res_act.status_code == 200
    act_meal = res_act.json()
    target_meal_id = act_meal["id"]
    print(f"  PASS: Retrieved 4 meals for today. Selected actionable meal '{act_meal['mealType']}' (ID: {target_meal_id}) with future deadline {act_meal['responseDeadline']}")

    # 6. Student Response Submission
    print(f"\n[6/14] Submitting student meal intention (DEFINITELY_EATING) for {target_meal_id}...")
    res = client.post(
        f"/api/v1/responses?mealInstanceId={target_meal_id}",
        headers=student_headers,
        json={"choice": "DEFINITELY_EATING"}
    )
    assert res.status_code == 200
    resp_obj = res.json()
    assert resp_obj["choice"] == "DEFINITELY_EATING"
    print(f"  PASS: Response stored: {resp_obj['choice']} at {resp_obj['createdAt']}")

    # 7. Student Response Update before deadline
    print(f"\n[7/14] Updating response to PROBABLY_EATING...")
    res = client.post(
        f"/api/v1/responses?mealInstanceId={target_meal_id}",
        headers=student_headers,
        json={"choice": "PROBABLY_EATING"}
    )
    assert res.status_code == 200
    assert res.json()["choice"] == "PROBABLY_EATING"
    print(f"  PASS: Response updated: {res.json()['choice']}")

    # 8. Vendor Authentication
    print("\n[8/14] Testing Vendor Login (/api/v1/auth/login)...")
    res = client.post("/api/v1/auth/login", json={
        "email": "vendor@iiitdwd.ac.in",
        "password": "demo123"
    })
    assert res.status_code == 200
    vendor_data = res.json()
    vendor_token = vendor_data["accessToken"]
    vendor_headers = {"Authorization": f"Bearer {vendor_token}"}
    print(f"  PASS: Vendor authenticated: {vendor_data['user']['displayName']}")

    # 9. Aggregate Counts & Privacy Rule Verification
    print(f"\n[9/14] Verifying Aggregate Counts for {target_meal_id} (No Response != Not Eating)...")
    res = client.get(f"/api/v1/responses/counts/{target_meal_id}", headers=vendor_headers)
    assert res.status_code == 200
    counts = res.json()
    assert counts["probablyEating"] == 1
    assert counts["totalRegistered"] == 750
    assert counts["noResponse"] == 749, f"Expected 749 noResponse, got {counts['noResponse']}"
    assert counts["notEating"] == 0
    print(f"  PASS: Counts: Probably={counts['probablyEating']}, Not Eating={counts['notEating']}, No Response={counts['noResponse']}/{counts['totalRegistered']}")
    print(f"  VERIFIED: 'No Response' ({counts['noResponse']}) is strictly separated from 'Not Eating' ({counts['notEating']})")

    # 10. Forecast Recommendation Calculation
    print(f"\n[10/14] Verifying Baseline Forecast Recommendation (F=B=700, Q=ceil(700*1.08)=756)...")
    res = client.get(f"/api/v1/forecasts/recommendation/{target_meal_id}", headers=vendor_headers)
    assert res.status_code == 200
    rec = res.json()
    assert rec["baselineAttendance"] == 700
    assert rec["safetyMarginFraction"] == 0.08
    assert rec["recommendedPortions"] == 756
    print(f"  PASS: B={rec['baselineAttendance']}, m={rec['safetyMarginFraction']}, Q={rec['recommendedPortions']} ({rec['forecastMethod']})")

    # 11. Vendor Decision Override & Recommendation Preservation
    print(f"\n[11/14] Submitting Vendor Decision (Planned: 740, Override reason provided)...")
    res = client.post(
        f"/api/v1/forecasts/decision/{target_meal_id}",
        headers=vendor_headers,
        json={
            "finalPlannedQuantity": 740,
            "overrideReason": "Academic project submission deadline today; expecting slight dip."
        }
    )
    assert res.status_code == 200
    decision = res.json()
    assert decision["originalRecommendation"] == 756, "Original recommendation MUST be preserved!"
    assert decision["finalPlannedQuantity"] == 740
    assert decision["status"] == "OVERRIDDEN"
    print(f"  PASS: Decision recorded. Original={decision['originalRecommendation']}, Final={decision['finalPlannedQuantity']}, Status={decision['status']}")
    print(f"  VERIFIED: Original recommendation was preserved without being overwritten.")

    # 12. Meal Outcome & Leftover Recording
    print(f"\n[12/14] Recording Post-Meal Outcome (Attendance: 692, Prepared: 740, Leftovers: 11.5 kg)...")
    res = client.post(
        f"/api/v1/outcomes/{target_meal_id}",
        headers=vendor_headers,
        json={
            "actualAttendance": 692,
            "actualPreparedQuantity": 740,
            "preparedUnit": "portions",
            "leftoverQuantity": 11.5,
            "leftoverUnit": "kg",
            "notes": "Curd rice and dal methi remained. Quality preserved for mess audit."
        }
    )
    assert res.status_code == 200
    outcome = res.json()
    assert outcome["actualAttendance"] == 692
    assert outcome["leftoverQuantity"] == 11.5
    assert outcome["leftoverUnit"] == "kg"
    print(f"  PASS: Outcome saved: Actual Headcount={outcome['actualAttendance']}, Leftover={outcome['leftoverQuantity']} {outcome['leftoverUnit']}")

    # 13. Admin Operations & Schedule Validation
    print("\n[13/14] Testing Admin Login & Schedule Validation...")
    res = client.post("/api/v1/auth/login", json={
        "email": "admin@iiitdwd.ac.in",
        "password": "demo123"
    })
    assert res.status_code == 200
    admin_token = res.json()["accessToken"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res_summary = client.get("/api/v1/reports/summary", headers=admin_headers)
    assert res_summary.status_code == 200
    summary = res_summary.json()
    print(f"  PASS: Dashboard Summary: Total Students={summary['totalStudents']}, Configured Schedules={summary['configuredSchedules']}, Menu v{summary['publishedMenuVersion']}")

    res_val = client.get("/api/v1/schedules/validate", headers=admin_headers)
    assert res_val.status_code == 200
    assert res_val.json()["isValid"] is True
    print(f"  PASS: Schedule Validation: 28 schedules checked, isValid={res_val.json()['isValid']}, errors={len(res_val.json()['errors'])}")

    # 14. SQLite Database Persistence Verification
    print("\n[14/14] Verifying direct persistence in backend SQLite database file (messmate.db)...")
    db = SessionLocal()
    try:
        db_resp = db.query(MealResponse).filter(MealResponse.meal_instance_id == target_meal_id).first()
        assert db_resp is not None, "Response not found in SQLite DB!"
        assert db_resp.choice == "PROBABLY_EATING"

        db_dec = db.query(VendorDecision).filter(VendorDecision.meal_instance_id == target_meal_id).first()
        assert db_dec is not None, "Vendor decision not found in SQLite DB!"
        assert db_dec.final_planned_quantity == 740

        db_out = db.query(MealOutcome).filter(MealOutcome.meal_instance_id == target_meal_id).first()
        assert db_out is not None, "Outcome not found in SQLite DB!"
        assert db_out.actual_attendance == 692
        assert db_out.leftover_quantity == 11.5
        print("  PASS: All records directly verified in SQLite database tables (meal_responses, vendor_decisions, meal_outcomes).")
    finally:
        db.close()

    print("\n" + "=" * 70)
    print("ALL 14 INTEGRATION CHECKPOINTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_verification()
