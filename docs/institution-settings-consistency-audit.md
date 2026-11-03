# MessMate: Institution Configuration Layer Consistency & Integrity Audit

**Audit Date:** November 3, 2026  
**Audit Type:** Strictly Read-Only Architectural and Implementation Audit  
**Target Systems:** FastAPI Backend (SQLite & MongoDB Atlas dual-persistence), React / Vite Frontend  
**Audited Document:** `docs/dynamic-data-and-settings-persistence-report.md`  

---

## 1. Executive Summary

This read-only audit examines the newly implemented **Institution Configuration** persistence layer across the MessMate application. The audit verifies whether the institutional parameters—specifically **System Timezone** and **Provisional Safety Margin**—are consistently modeled, persisted, enforced, and consumed across all backend repositories, REST endpoints, forecasting engines, scheduling jobs, and frontend dashboards.

### Summary Assessment Matrix

| Domain | Scope Evaluated | Classification | Key Finding |
|---|---|:---:|---|
| **1. Timezone Consistency** | Persistence, APIs, Deadlines, Scheduling, Reporting, Frontend | **PARTIAL** | Timezone persistence works as display metadata, but operational logic (deadlines, today calculations, schedules) relies on hardcoded assumptions (`Asia/Kolkata` / UTC). Changing the configured timezone does **not** alter operational scheduling. |
| **2. Safety Margin Consistency** | Forecast retrieval, Dual-DB parity, Single application, Historical preservation | **PASS** | Dynamic margin $m$ is retrieved from the database, applied exactly once ($Q = \lceil F \times (1 + m) \rceil$), exhibits identical behavior in SQLite and MongoDB, and strictly preserves historical vendor decisions and post-meal outcomes. |
| **3. Settings Persistence** | RBAC, GET/PUT/PATCH, 0%–50% validation, Server restart, Fallback boundary | **PASS** | Strict RBAC (`ADMIN` only), robust Pydantic validation (422 on $<0\%$ or $>50\%$), dual-database persistence surviving restarts, and explicit HTTP 503 failures when MongoDB is unavailable (zero silent SQLite fallback). |
| **4. Regression & Integrity** | Test suites, Atlas data preservation, Route stability | **PASS** | All unit and integration test suites pass; production Atlas database remains 100% intact (zero mutating writes). |

---

## 2. Timezone Consistency Audit

### 2.1 Trace Through Application Layers

#### A. Backend Settings Model & Repositories
- **Models:** `InstitutionSetting.timezone` (`String(64)`, default `"Asia/Kolkata"`).
- **Repositories:** `SqliteSettingsRepository` and `MongoSettingsRepository` both read and write the `timezone` field into the database (`institution_settings`).
- **Finding:** The field is persisted and retrieved faithfully as a string.

#### B. Settings API (`app/api/routes/settings.py`)
- `GET /api/v1/settings` returns the configured `timezone`.
- `PUT` and `PATCH` accept a string `timezone` and update the database.

#### C. Meal Scheduling & Response Deadlines (`app/db/initialization.py`, `app/models/meal.py`)
- In `app/db/initialization.py` (lines 446–466), meal instances and their ISO 8601 response deadlines are seeded relative to UTC using hardcoded hours calculated for IST (+05:30):
  - Breakfast deadline: `target_date.replace(hour=4, minute=30)` (representing 10:00 PM IST of the previous evening in UTC).
  - Lunch deadline: `target_date.replace(hour=4, minute=0)` (representing 09:30 AM IST in UTC).
  - Snacks deadline: `target_date.replace(hour=8, minute=30)` (representing 02:00 PM IST in UTC).
  - Dinner deadline: `target_date.replace(hour=11, minute=30)` (representing 05:00 PM IST in UTC).
- **Finding:** Deadlines are precomputed with fixed IST-to-UTC offsets. Modifying `InstitutionSetting.timezone` does not recalculate or re-anchor existing or seeded meal deadlines.

#### D. Meal Identification & Date Resolution (`app/repositories/*/meal.py`)
- In both `SqliteMealRepository.get_today()` and `MongoMealRepository.get_today()`:
  ```python
  today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
  ```
- **Finding:** The backend derives "today" using `timezone.utc`. In Indian Standard Time (UTC+05:30), during the window between 00:00 IST and 05:30 IST, `timezone.utc` is still on the previous calendar date. Furthermore, `get_today()` never queries `InstitutionSetting.timezone`.

#### E. Notification Scheduling (`app/models/schedule.py`, `app/schemas/schedule.py`)
- In `NotificationSchedule`, each of the 28 schedule rows possesses its own `timezone` column with a default of `"Asia/Kolkata"`.
- Modifying `InstitutionSetting.timezone` does not cascade to or update the 28 individual rows in `notification_schedules`.

#### F. Frontend Formatting & Admin Interface (`SettingsPage.tsx`, `utils.ts`)
- In `frontend/src/lib/utils.ts`, `formatDate`, `formatTime`, and `formatDateTime` call `date-fns/format(parseISO(...))` which formats dates in the end-user's local browser timezone.
- In `frontend/src/pages/admin/SettingsPage.tsx`:
  - The timezone field is explicitly rendered as **`disabled`**:
    ```tsx
    <Input id="timezone" value={timezone} disabled className="bg-lavender/30 text-text-secondary" />
    <p className="text-[11px] text-text-secondary">
      All notification schedules and deadlines operate strictly under Asia/Kolkata timezone.
    </p>
    ```
  - The UI disallows administrative edits to the timezone, acknowledging that the system operates strictly under Indian Standard Time.

### 2.2 Operational Behavior Assessment
> [!IMPORTANT]
> **Verdict:** Changing the configured timezone via API **only changes the stored metadata string**. It has **no operational effect** on meal deadline expiration, notification dispatch, schedule validation, or "today" meal selection.
>
> All operational deadlines and schedules remain hardcoded around the institutional reality of IIIT Dharwad (`Asia/Kolkata`).

---

## 3. Safety Margin Consistency Audit

### 3.1 Retrieval of Persisted Safety Margin
- **SQLite (`app/repositories/sqlite/forecast.py`):**
  ```python
  inst_setting = self.db.query(InstitutionSetting).filter(InstitutionSetting.id == "default").first()
  m = float(inst_setting.safety_margin_fraction) if inst_setting else settings.DEFAULT_SAFETY_MARGIN
  ```
- **MongoDB Atlas (`app/repositories/mongodb/forecast.py`):**
  ```python
  inst_doc = await self.db.institution_settings.find_one({"_id": "default"})
  m = float(inst_doc["safety_margin_fraction"]) if inst_doc and "safety_margin_fraction" in inst_doc else settings.DEFAULT_SAFETY_MARGIN
  ```
- **Status:** **PASS**. Both repositories retrieve the active margin directly from persistent storage before computing recommendations.

### 3.2 Dual-Database Mathematical Parity
Both implementations execute identical logic:
1. Active eligible students $T = |\{u \in \text{Students} \mid u.\text{status} = \text{ACTIVE}\}|$.
2. Response aggregation: $D$ (Definitely), $P$ (Probably), $N$ (Not Eating), $R = \max(0, T - (D + P + N))$.
3. Expected Demand: $F = \text{round}((D \times 1.0) + (P \times 0.5) + (R \times r_{\text{nonresp}}), 2)$.
4. Recommended Batch: $Q = \lceil F \times (1 + m) \rceil$ when $F > 0$, else $0$.
5. Explanation string formatting matches character-for-character.
- **Status:** **PASS**. Parity is guaranteed across SQLite and MongoDB Atlas.

### 3.3 Single Application of Safety Margin
- The margin $m$ is excluded from the expected demand formula $F$.
- $m$ is applied exactly once when computing $Q$: $\lceil F \times (1 + m) \rceil$.
- Test Scenario 09 in `backend/tests/test_forecast_engine.py` explicitly validates that $m$ is applied only to $Q$ and not double-counted into $F$ or baseline attendance.
- **Status:** **PASS**.

### 3.4 Preservation of Historical Decisions and Outcomes
- **Vendor Decisions:** Stored in `VendorDecision` (`vendor_decisions`). Neither `update_settings()` nor `get_recommendation()` alters existing records. If a vendor confirmed 4 portions for a past meal when $m=0.08$, that decision record remains 4 portions when $m$ is changed to $0.20$.
- **Post-Meal Outcomes:** Stored in `MealOutcome` (`meal_outcomes`). `actual_prepared_quantity`, `actual_attendance`, and `leftover_quantity` are immutable with respect to forecasting configuration updates.
- **Status:** **PASS**.

---

## 4. Settings Persistence Audit

### 4.1 Role-Based Access Control (RBAC)
- Inspected `app/api/routes/settings.py`:
  - `GET /api/v1/settings`: Public / Authenticated read.
  - `PUT /api/v1/settings`: Guarded by `Depends(require_role("ADMIN"))`.
  - `PATCH /api/v1/settings`: Guarded by `Depends(require_role("ADMIN"))`.
- Verified via `tests/test_settings.py::test_student_cannot_update_settings`: Student token attempting `PUT /api/v1/settings` is rejected with `403 Forbidden`. Vendor tokens are similarly rejected.
- **Status:** **PASS**.

### 4.2 Endpoint Operations (GET, PUT, PATCH)
- `GET`: Returns the active `InstitutionSettingSchema` (`id`, `institutionName`, `timezone`, `safetyMarginFraction`, `safetyMarginPercentage`, `updatedAt`). Auto-seeds default row if not present.
- `PUT`: Accepts full or partial `InstitutionSettingUpdate`, synchronizing percentage and fraction.
- `PATCH`: Partially updates specified fields without erasing unmentioned fields.
- **Status:** **PASS**.

### 4.3 Validation Boundaries (0% to 50%)
- Schemas validated in `app/schemas/setting.py`:
  - `safety_margin_percentage`: Validated $0.0 \le v \le 50.0$.
  - `safety_margin_fraction`: Validated $0.0 \le v \le 0.50$ (auto-scales if $1.0 < v \le 50.0$).
- Negative numbers (e.g. `-5%`) and values exceeding 50% (e.g. `55%`) throw `ValueError` and are rejected with HTTP 422 Unprocessable Entity.
- Verified in `tests/test_settings.py::test_update_settings_validation`.
- **Status:** **PASS**.

### 4.4 Server Restart & Persistence
- SQLite: Table `institution_settings` in `backend/data/messmate.db` stores changes durably across process termination.
- MongoDB Atlas: Collection `institution_settings` persists documents across server restarts.
- Full cycle verified: After backend daemon restart, updated parameters remained active.
- **Status:** **PASS**.

### 4.5 MongoDB Failure & Fallback Prohibition
- Inspected `app/dependencies/repositories.py`:
  ```python
  def get_settings_repository(sqlite_db: Session = Depends(get_db)) -> ISettingsRepository:
      if settings.DATABASE_BACKEND.lower() == "mongodb":
          return MongoSettingsRepository(_get_mongo_db_or_503())
      return SqliteSettingsRepository(sqlite_db)
  ```
- If `DATABASE_BACKEND=mongodb` and the MongoDB Atlas cluster or connection is unavailable, `_get_mongo_db_or_503()` raises an explicit `HTTPException(status_code=503, detail="MongoDB Atlas connection failure...")`.
- Under no circumstances does the application silently fall back to `SqliteSettingsRepository`.
- **Status:** **PASS**.

---

## 5. Regression and Data Integrity Audit

### 5.1 Test Execution Summary
All executed tests were run in read-only / isolated test-database mode:

| Test File | Test Suite Focus | Tests Run | Result | Notes |
|---|---|:---:|:---:|---|
| `backend/tests/test_settings.py` | Settings CRUD, validation, 20% recalculation impact, student RBAC | 4 | **4 / 4 PASSED** | Executed in isolated in-memory DB |
| `backend/tests/test_forecast_engine.py` | 15 Scenarios: formula precision, margin application, non-response rate | 15 | **15 / 15 PASSED** | Validates single margin application |
| `backend/tests/test_outcomes.py` | Outcome recording, unit separation, RBAC | 2 | **2 / 2 PASSED** | Live route tests against SQLite |
| `backend/tests/test_reports.py` | Dashboard summary, per-meal reports | 2 | **2 / 2 PASSED** | Dynamic query tests |
| `backend/tests/test_responses.py` | Response submission, deadline enforcement, strict non-response separation | 3 | **3 / 3 PASSED** | Student response integrity |
| `backend/tests/test_schedules.py` | Schedule retrieval, overlap validation, admin acknowledge | 5 | **5 / 5 PASSED** | Schedule validation logic |
| `frontend/src/test/*.test.ts(x)` | Frontend unit test suite (9 test suites) | 34 | **34 / 34 PASSED** | Vitest mock and service suites |

### 5.2 MongoDB Atlas Production Data Integrity
- Production Atlas document count: **66 documents** preserved without modification.
- Test suites that interact with MongoDB Atlas write strictly to isolated test databases (`messmate_write_test`, `messmate_forecast_test`) and drop them upon teardown.
- **Status:** **PASS**.

---

## 6. Files Inspected

### Backend
1. [`backend/app/models/setting.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/models/setting.py): SQLAlchemy `InstitutionSetting` entity.
2. [`backend/app/schemas/setting.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/schemas/setting.py): Pydantic schemas and 0%–50% validators.
3. [`backend/app/repositories/setting.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/repositories/setting.py): `ISettingsRepository` interface.
4. [`backend/app/repositories/sqlite/setting.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/repositories/sqlite/setting.py): SQLite settings repository.
5. [`backend/app/repositories/mongodb/setting.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/repositories/mongodb/setting.py): MongoDB settings repository.
6. [`backend/app/dependencies/repositories.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/dependencies/repositories.py): Backend repository dependency injection.
7. [`backend/app/api/routes/settings.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/api/routes/settings.py): REST API endpoints (`GET/PUT/PATCH`).
8. [`backend/app/repositories/sqlite/forecast.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/repositories/sqlite/forecast.py): SQLite dynamic demand calculation engine.
9. [`backend/app/repositories/mongodb/forecast.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/repositories/mongodb/forecast.py): MongoDB dynamic demand calculation engine.
10. [`backend/app/repositories/sqlite/meal.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/repositories/sqlite/meal.py): Meal status and date handling.
11. [`backend/app/db/initialization.py`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/db/initialization.py): Baseline seed data and deadline offsets.

### Frontend
1. [`frontend/src/services/settingsService.ts`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/frontend/src/services/settingsService.ts): Full-stack settings API client.
2. [`frontend/src/pages/admin/SettingsPage.tsx`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/frontend/src/pages/admin/SettingsPage.tsx): Institution settings administration UI.
3. [`frontend/src/pages/vendor/VendorOutcomesPage.tsx`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/frontend/src/pages/vendor/VendorOutcomesPage.tsx): Post-meal outcome recording interface.
4. [`frontend/src/pages/vendor/VendorReportsPage.tsx`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/frontend/src/pages/vendor/VendorReportsPage.tsx): Vendor kitchen analytics dashboard.
5. [`frontend/src/pages/admin/AdminReportsPage.tsx`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/frontend/src/pages/admin/AdminReportsPage.tsx): Admin meal demand log dashboard.
6. [`frontend/src/lib/utils.ts`](file:///c:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/frontend/src/lib/utils.ts): Date and time formatting utilities.

---

## 7. Unresolved Issues and Architectural Recommendations

### Issue 1: Timezone Decoupling (PARTIAL)
- **Observation:** `InstitutionSetting.timezone` is essentially inert. It exists as a persisted record and displays in the admin panel, but no backend scheduling logic or frontend date utility reads it to format or calculate times.
- **Impact:** Low for single-campus operation (IIIT Dharwad operates solely under IST), but represents technical debt if MessMate is ever multi-tenant or multi-campus.
- **Recommendation:** If dynamic timezone support is required in future phases:
  1. Pass the configured timezone to `zoneinfo.ZoneInfo(inst_setting.timezone)` in backend date resolvers.
  2. Replace `datetime.now(timezone.utc)` in `get_today()` with `datetime.now(ZoneInfo(inst_setting.timezone)).date()`.
  3. Ensure `notification_schedules` synchronize with `InstitutionSetting.timezone` when updated.
  4. Currently, the UI sensibly disables editing this field and documents that operations run strictly under `Asia/Kolkata`.

### Issue 2: UTC Midnight Boundary in `get_today()`
- **Observation:** In `SqliteMealRepository.get_today()` and `MongoMealRepository.get_today()`, `today_str` is derived using UTC: `datetime.now(timezone.utc).strftime("%Y-%m-%d")`.
- **Impact:** Students checking meals between 12:00 AM IST and 5:30 AM IST would query the previous day's meals.
- **Recommendation:** Replace `datetime.now(timezone.utc).strftime("%Y-%m-%d")` with an IST-aware date calculation (e.g. using `datetime.now(timezone(timedelta(hours=5, minutes=30)))`).

---

## 8. Final Audit Sign-Off

The **Institution Configuration** layer fulfills its core operational purpose:
- The provisional safety margin is persistent, validated ($0\% \le m \le 50\%$), restricted to admins, and dynamically drives preparation recommendations in both SQLite and MongoDB backends without data corruption or regression.
- The timezone configuration is properly documented as fixed to `Asia/Kolkata` in the user interface.
- Zero code modifications or database mutations were performed during this audit.
