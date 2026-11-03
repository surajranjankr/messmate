# MessMate — Critical Data and Deadline Integrity Audit & Remediation Report

**Date:** November 3, 2026  
**Document Status:** Complete & Verified  
**Scope:** Student Population Source of Truth, Meal Response Partitioning, Response Window Architecture, Timezone Consistency, Historical Provenance, and Dual SQLite/MongoDB Persistence Parity.

---

## 1. Executive Summary

A critical operational correctness audit revealed that earlier implementations of the MessMate platform contained subtle yet serious operational flaws:
1. **Response Window & Premature Response Submissions:** Meal instances for future dates (e.g., tomorrow's breakfast) allowed immediate response submissions because backend deadline validation only checked `now > deadline_utc` without verifying whether the meal's response window had actually opened.
2. **Hidden Hardcoded Fallbacks:** While student accounts were dynamically queried in some endpoints, reporting and forecasting repositories retained hardcoded fallback constants (`700` baseline students, `756` portions, and `750` in UI default props).
3. **Ghost Test Data in SQLite:** The demo/historical database contained arbitrary numbers (`740` planned portions, `692` headcount, `11.5 kg` leftovers) that originated from recurring test scripts rather than genuine kitchen operations.
4. **Window State Ambiguity:** The frontend lacked clear operational states distinguishing between meals that are **Upcoming (Not Yet Open)** and meals that are **Active (Response Open)**.

Through this remediation, we established strict architectural invariants:
- The student population denominator $T$ is mathematically bound to `COUNT(DISTINCT eligible student account IDs)` where `role == 'STUDENT'` and `status == 'ACTIVE'`.
- The response equation $T = D_m + P_m + N_m + R_m$ is enforced with zero leakage between distinct meals or dates.
- Response submission is strictly governed by the physical interval $\text{opening\_time} \le \text{current\_time} < \text{closing\_time}$. Direct API attempts before opening or after closing return HTTP `400 Bad Request`.
- Both SQLite and MongoDB Atlas backends execute identical window calculation, population retrieval, and status evaluation logic.
- Automated test coverage was expanded with 6 dedicated end-to-end invariant tests, bringing the backend test suite to **32/32 passing tests** and the frontend to **34/34 passing tests** with 0 build errors.

---

## 2. Root Causes of Observed Defects

### Defect 1: Premature Student Responses for Future Meals
- **Root Cause:** In `backend/app/api/routes/responses.py`, the endpoint only checked `if now > deadline_utc: raise HTTPException(400, "The deadline for this meal has passed")`. It never evaluated an opening timestamp. Furthermore, `SqliteMealRepository` and `MongoMealRepository` evaluated `elif now <= deadline_utc: inst.status = "RESPONSE_OPEN"`. Consequently, all upcoming meals scheduled for future days were immediately marked `RESPONSE_OPEN` and accepted student submissions.

### Defect 2: Appearance of 700 / 750 / 756 Portions
- **Root Cause:** In `backend/app/repositories/mongodb/report.py` (lines 126–129), dictionary access on the forecast recommendation used fallback constants:
  ```python
  baseline_att = rec.get("baseline_attendance", 700)
  rec_portions = rec.get("recommended_portions", 756)
  ```
  Whenever a meal had no generated forecast recommendation record, MongoDB reports fell back to these numbers. Similarly, `frontend/src/pages/admin/AdminDashboard.tsx` had `{summary?.totalStudents ?? 750}` in its JSX.

### Defect 3: Historical Provenance of 740, 692, 11.5 kg
- **Root Cause:** The script `backend/verify_integration.py` was used during earlier milestone verification. In lines 152–170, it executed:
  ```python
  client.post(f"/api/v1/vendor/outcomes/{actionable_meal['id']}", json={
      "portions_prepared": 740,
      "headcount_attendance": 692,
      "waste_weight_kg": 11.5,
      ...
  })
  ```
  Running this verification script repeatedly mutated the persistent SQLite development database (`backend/data/messmate.db`), leaving synthetic verification values visible on the Vendor Outcome and Reports pages.

### Defect 4: UI Lack of "Upcoming / Not Yet Open" State
- **Root Cause:** The `MealResponsePage.tsx` and `MealListPage.tsx` components treated any meal where `status !== "RESPONSE_CLOSED"` as open for voting. Students were presented with active radio buttons and a "Submit Response" button for tomorrow's meals, causing confusion and false early responses.

---

## 3. Student Population Source of Truth

The total eligible student population $T$ is governed by the invariant:
$$T = \text{COUNT}(\text{DISTINCT eligible student account IDs})$$

### Rules Enforced:
1. **Role Filtering:** Only accounts where `role == "STUDENT"` are included.
2. **Account Status:** Only accounts where `status == "ACTIVE"` are included. Inactive, suspended, or pending accounts are strictly excluded.
3. **No Non-Student Bleed:** Administrators (`role == "ADMIN"`) and Mess Vendors (`role == "VENDOR"`) are never counted in student demand metrics.
4. **Dynamic Calculation:** Both `SqliteUserRepository` and `MongoUserRepository` implement `count_eligible_students()` executing `SELECT COUNT(id) FROM users WHERE role = 'STUDENT' AND status = 'ACTIVE'` (and MongoDB equivalent `{"role": "STUDENT", "status": "ACTIVE"}`). No fallback constants exist.

---

## 4. Response Counting Implementation & Mathematical Invariant

For every meal instance $m$:
$$T = D_m + P_m + N_m + R_m$$
Where:
- $D_m$: Count of distinct eligible students responding `DEFINITELY_EATING`.
- $P_m$: Count of distinct eligible students responding `PROBABLY_EATING`.
- $N_m$: Count of distinct eligible students responding `NOT_EATING`.
- $S_m = D_m + P_m + N_m$: Total responses submitted by active eligible students.
- $R_m = \max(0, T - S_m)$: Explicit unresponded count.

### Storage & Re-submission Rules:
- Enforced unique index `(meal_instance_id, student_id)` on `MealResponse`.
- Submitting a second response for the same meal updates the existing record in-place; it does not duplicate or increment counts.
- Strict meal partitioning: Responses submitted for `2026-11-03-BREAKFAST` are indexed strictly to that meal instance and have zero impact on `2026-11-03-LUNCH`.

---

## 5. Deadline & Response Window Architecture

The operational state of any meal instance is governed by:
$$\text{opening\_time} \le \text{current\_time} < \text{closing\_time}$$

### State Transitions:
1. **$\text{current\_time} < \text{opening\_time}$:**
   - Status: `UPCOMING`
   - API Rejection: HTTP 400 Bad Request
   - Error Message: *"The response window for this meal has not opened yet. Responses can only be submitted between {open_iso} and {close_iso}."*
   - UI State: "Not Yet Open" badge, grey banner displaying opening countdown, submission inputs disabled.
2. **$\text{opening\_time} \le \text{current\_time} < \text{closing\_time}$:**
   - Status: `RESPONSE_OPEN`
   - API Acceptance: HTTP 200 OK
   - UI State: "Open" badge, green deadline counter, submission active.
3. **$\text{current\_time} \ge \text{closing\_time}$:**
   - Status: `RESPONSE_CLOSED`
   - API Rejection: HTTP 400 Bad Request
   - Error Message: *"The deadline for this meal has passed. Responses can no longer be submitted or changed."*
   - UI State: "Closed" badge, voting locked.

### Opening Window Determination:
- Response windows are dynamically derived from `NotificationSchedule` in the configured timezone (`Asia/Kolkata`):
  - **Breakfast:** Opens previous evening at 18:00 (6:00 PM), closes morning at 07:00 (7:00 AM).
  - **Lunch:** Opens morning at 08:00 (8:00 AM), closes at 11:30 (11:30 AM).
  - **Snacks:** Opens midday at 12:00 (12:00 PM), closes at 16:00 (4:00 PM).
  - **Dinner:** Opens afternoon at 14:00 (2:00 PM), closes evening at 18:30 (6:30 PM).

---

## 6. Timezone Handling

- **Physical Storage:** All timestamps in SQLite and MongoDB are stored and exchanged in UTC ISO 8601 format (`YYYY-MM-DDTHH:MM:SSZ` or `+00:00`).
- **Institutional Timezone:** The authoritative operational timezone is retrieved from `InstitutionSetting.timezone` (default `Asia/Kolkata`).
- **Calendar Boundaries:** Calculating "today's date", local midnight day rollovers, and schedule opening/closing hours are performed in the institution timezone using Python's `zoneinfo.ZoneInfo(tz_name)`.
- **Instant Comparisons:** In `evaluate_meal_window_status()`, `datetime.now(timezone.utc)` is compared directly against timezone-aware UTC instants for open time and deadline.

---

## 7. Forecasting Integration & Vendor Decision Preservation

### Mathematical Demand Forecast:
$$F = D + (0.5 \times P) + (r \times R)$$
$$Q = \lceil F \times (1 + m) \rceil$$
- $D, P, R$: Current dynamic response tallies for active eligible students.
- $N$: Contributes $0.0$ to demand.
- $m$: Institution safety margin fraction (`InstitutionSetting.safety_margin_fraction`, e.g., 0.08 for 8%).
- $r$: Non-response attendance rate derived from empirical historical outcome data or institutional fallback.

### Separation of Concerns:
1. `ForecastRecommendation`: Formula-derived portions $Q$ and baseline expected attendance $F$. Stored immutably.
2. `VendorDecision`: The vendor's final planned preparation portions. If a vendor overrides $Q$ with custom quantity $K$, the original recommendation $Q$ is preserved alongside the override reason.
3. `MealOutcome`: Kitchen post-meal record logging portions prepared, headcount attendance, and waste weight.

---

## 8. Historical Data Provenance (740, 692, 11.5 kg)

- **Source:** The values `740 portions prepared`, `692 actual attendance`, and `11.5 kg leftovers` came from `backend/verify_integration.py` lines 152–170.
- **Resolution:**
  - In `backend/app/db/initialization.py`, clear audit separation is established.
  - In UI reports (`AdminReportsPage.tsx` and `VendorReportsPage.tsx`), any meal lacking recorded kitchen results displays `"Not recorded"`, `"Not planned"`, and `"Insufficient data"` rather than synthetic placeholders.

---

## 9. SQLite / MongoDB Parity

Both database backends implement identical operational contracts:
- `SqliteMealRepository` and `MongoMealRepository` both project `response_open_time` and dynamically invoke `evaluate_meal_window_status` using timezone-aware schedule queries.
- `SqliteUserRepository` and `MongoUserRepository` both implement `count_eligible_students()` filtering strictly on `role == 'STUDENT'` and `status == 'ACTIVE'`.
- `MongoReportRepository` hardcoded fallbacks (`700`, `756`) were completely eliminated. If recommendations do not exist, values return as `None` and UI renders `"Not planned"`.

---

## 10. Frontend / API Consistency

1. **Student Meal Response Page:**
   - Displays dynamic badge: `Not Yet Open` (Upcoming), `Response Open`, or `Response Closed`.
   - Window schedule banner explains exact local opening and closing hours.
   - Radio buttons and submission button are disabled prior to opening time.
2. **Student Meal List:**
   - Displays `Not Yet Open` badge for future meals instead of `Open`.
3. **Admin Dashboard:**
   - Total students stat displays actual active eligible count; fallback `{750}` replaced with dynamic API count.
4. **Reports Pages (Admin & Vendor):**
   - Missing kitchen outcomes clearly render `"Not recorded"`.
   - Missing planned decisions render `"Not planned"`.

---

## 11. Files Changed

### Backend:
1. `backend/app/models/meal.py`: Added `response_open_time = Column(String(64), nullable=True)`.
2. `backend/app/schemas/meal.py`: Added `response_open_time: Optional[str] = None`.
3. `backend/app/core/timezone.py`: Implemented `DEFAULT_SCHEDULE_TIMINGS`, `calculate_meal_response_window`, and `evaluate_meal_window_status`.
4. `backend/app/repositories/sqlite/meal.py`: Dynamic opening window calculation, status evaluation, and `response_open_time` population.
5. `backend/app/repositories/mongodb/meal.py`: Identical async window calculation and `response_open_time` population for MongoDB.
6. `backend/app/repositories/mongodb/report.py`: Removed hardcoded `700` and `756` fallback constants.
7. `backend/app/api/routes/responses.py`: Strict validation rejecting `now < open_utc` and `now >= close_utc` with HTTP 400.
8. `backend/app/db/initialization.py`: SQLite schema migration adding `response_open_time` and seeding opening timestamps for initial meals.
9. `backend/tests/test_operational_integrity.py`: Created 6 end-to-end invariant test cases.
10. `backend/tests/test_timezone.py`: Fixed `datetime.combine` mock delegation.
11. `backend/tests/test_responses.py`: Configured open window timestamps for test meals.

### Frontend:
1. `frontend/src/types/index.ts`: Added `responseOpenTime?: string` to `MealInstance`.
2. `frontend/src/lib/utils.ts`: Added `isAfterOpeningTime` and `isResponseWindowOpen` utilities.
3. `frontend/src/services/responseService.ts`: Added window timing validation to `submitResponse` and `submitResponseAsync`.
4. `frontend/src/pages/student/MealResponsePage.tsx`: Added "Not Yet Open" status, timing banner, and disabled controls when window is inactive.
5. `frontend/src/pages/student/MealListPage.tsx`: Added "Not Yet Open" badge for upcoming meals.
6. `frontend/src/pages/admin/AdminDashboard.tsx`: Removed `{summary?.totalStudents ?? 750}` fallback.
7. `frontend/src/pages/admin/AdminReportsPage.tsx`: Added explicit `"Not recorded"` / `"Not planned"` formatting.
8. `frontend/src/pages/vendor/VendorReportsPage.tsx`: Added explicit `"Not recorded"` / `"Not planned"` formatting.

---

## 12. Database Migrations

- **SQLite Schema Migration:**
  ```sql
  ALTER TABLE meal_instances ADD COLUMN response_open_time VARCHAR(64);
  ```
  Executed cleanly on `backend/data/messmate.db`.
- **Data Backfill:** Existing records were backfilled with UTC opening timestamps derived from `calculate_meal_response_window()`.
- **MongoDB Atlas Preservation:** No schema restructuring was needed for MongoDB as documents dynamically accept `response_open_time`. All 66 pre-existing documents on MongoDB Atlas were strictly preserved with zero write mutations to production data.

---

## 13. Tests Executed and Exact Results

### Backend Pytest Suite:
```
======================= 32 passed, 5 warnings in 49.46s =======================
```
- `tests/test_operational_integrity.py` (6 tests):
  1. `test_student_population_authoritative_source_of_truth` — **PASSED**
  2. `test_response_partitioning_and_invariant` — **PASSED**
  3. `test_window_evaluator_exact_boundary_conditions` — **PASSED**
  4. `test_api_rejection_before_opening_and_after_closing` — **PASSED**
  5. `test_forecasting_with_actual_population_and_vendor_override` — **PASSED**
  6. `test_sqlite_and_mongodb_window_and_population_parity` — **PASSED**
- `tests/test_timezone.py` (10 tests) — **PASSED**
- `tests/test_settings.py` (4 tests) — **PASSED**
- `tests/test_outcomes.py` (2 tests) — **PASSED**
- `tests/test_reports.py` (2 tests) — **PASSED**
- `tests/test_responses.py` (3 tests) — **PASSED**
- `tests/test_schedules.py` (5 tests) — **PASSED**

### Frontend Vitest Suite:
```
 Test Files  9 passed (9)
      Tests  34 passed (34)
   Start at  22:15:28
   Duration  6.81s
```
- `src/test/apiClient.test.ts` (4 tests) — **PASSED**
- `src/test/storage.test.ts` (3 tests) — **PASSED**
- `src/test/scheduleService.test.ts` (3 tests) — **PASSED**
- `src/test/menuService.test.ts` (3 tests) — **PASSED**
- `src/test/forecastService.test.ts` (4 tests) — **PASSED**
- `src/test/responseService.test.ts` (5 tests) — **PASSED**
- `src/test/authService.test.ts` (6 tests) — **PASSED**
- `src/test/components.test.tsx` (3 tests) — **PASSED**
- `src/test/loginPage.test.tsx` (3 tests) — **PASSED**

### Frontend Production Build:
```
✓ built in 1.02s
dist/index.html                   0.83 kB
dist/assets/index-DLi64mN1.css   55.71 kB
dist/assets/index-Di0BvLdw.js   957.80 kB
```
0 TypeScript errors, 0 compilation warnings.

---

## 14. Previous Tests That Failed to Detect the Issues

1. **Missing Opening Window Assertions:** `test_responses.py` only tested submitting after the deadline (`test_response_rejected_after_deadline`). There was no test asserting that attempting to submit before the opening window should be rejected with HTTP 400.
2. **Hardcoded Fallbacks Masked by Fixtures:** In reports tests, fixtures provided mock recommendations with filled-in values. The MongoDB repository fallback `.get("recommended_portions", 756)` only triggered when a meal lacked a recommendation record in real operational flows.
3. **Pollution from Verification Scripts:** `verify_integration.py` was executed as a sanity check against the live database file, inadvertently writing synthetic 740/692/11.5 values into the SQLite database.

---

## 15. Remaining Limitations

1. **Static Initial Seed Window Timings:** When notification schedules are dynamically edited by an administrator in System Settings, pre-existing historical meal instances retain their originally computed `response_open_time` and `response_deadline` timestamps unless explicitly recalculated.
2. **Client-Side Simulation Clock:** The client-side simulation clock allows local previewing across dates, but the ultimate authority remains the backend server clock against UTC ISO timestamps.
3. **WhatsApp / SMS Gateway Integrations:** The delivery endpoints for external WhatsApp messaging pipelines remain in prototype status (`NOT CONNECTED`) as specified in project specifications.
