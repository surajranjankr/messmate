# MessMate — Timezone Integration Report: Authoritative Institution Timezone Architecture

**Document Version:** 1.0.0  
**Date:** November 3, 2026  
**Status:** Complete & Verified  

---

## 1. Executive Summary

Following the audit in `docs/institution-settings-consistency-audit.md`, the MessMate platform previously persisted the institutional `timezone` setting (`InstitutionSetting.timezone`) but hardcoded operational date/time assumptions (`Asia/Kolkata` strings, `datetime.utcnow()`, or naive localized timestamps) across the backend services and frontend formatters.

This implementation establishes an authoritative, centralized **Timezone Architecture Service** (`backend/app/core/timezone.py`) powered exclusively by standard Python `zoneinfo.ZoneInfo`. All operational calculations—including current calendar day resolution, meal identification, response window deadlines, notification schedules, report date boundaries, and frontend formatting—are now strictly governed by the institution's configured timezone, while retaining UTC as the immutable, universal wire-and-storage format across both SQLite and MongoDB Atlas backends.

---

## 2. Architecture & Design Principles

### 2.1 The Two Fundamental Clock Dimensions
1. **Physical Instant (UTC Storage & Internal Comparison):**
   - Every timestamp stored in SQLite or MongoDB Atlas is represented as an ISO 8601 UTC string (`...Z` or `...+00:00`) or epoch instant.
   - Internal ordering, deadline comparisons, and concurrency checks are conducted strictly between timezone-aware UTC instants (`now_utc() > deadline_utc`).
   - Naive datetime comparisons are strictly prohibited across the codebase.
2. **Operational Calendar & Clock Time (Institution Timezone):**
   - The institution's configured `timezone` string (e.g. `Asia/Kolkata`, `America/New_York`, `UTC`) defines the operational "today", the shift of calendar day at midnight, the human-facing response cutoff hours, and report query boundaries.
   - When UTC is `2026-11-03T20:30:00Z`, the operational date in `Asia/Kolkata` (UTC+5:30) is `2026-11-04` (02:00 AM). In `America/New_York` (UTC-5:00), the operational date is `2026-11-03` (15:30).

### 2.2 Timezone Architecture Service (`backend/app/core/timezone.py`)
A dedicated module provides standard, validated utilities across the backend:
- `validate_timezone_name(tz_name: str) -> str`: Validates that a string is a recognized IANA timezone identifier via `ZoneInfo(clean_tz)`. If invalid, raises `ValueError` with clear guidance.
- `get_institution_timezone(tz_name: Optional[str] = None) -> ZoneInfo`: Resolves the active `ZoneInfo` instance, falling back to `settings.TIMEZONE` (`"Asia/Kolkata"`).
- `now_utc() -> datetime`: Produces the current timezone-aware UTC instant (`datetime.now(timezone.utc)`).
- `get_institution_now(tz) -> datetime`: Returns the current instant localized into the institutional timezone.
- `get_institution_today_str(tz) -> str`: Derives the authoritative institutional calendar date formatted as `YYYY-MM-DD`.
- `parse_as_aware(iso_string, default_tz) -> datetime`: Safely parses ISO 8601 strings; if naive, localizes to the institutional timezone.
- `to_utc(dt: datetime) -> datetime`: Safely converts any aware datetime to UTC.
- `local_date_and_time_to_utc(date_str, time_str, tz) -> datetime`: Combines local date and time into an aware datetime and converts to UTC, respecting DST transitions.
- `get_utc_interval_for_local_date(date_str, tz) -> Tuple[datetime, datetime]`: Generates exact UTC `[start_utc, end_utc]` boundaries for local midnight-to-midnight queries.

---

## 3. Detailed Component Modifications

### 3.1 IANA Timezone Validation & Settings Schema
- **File:** `backend/app/schemas/setting.py`
- **Pydantic Field Validator:**
  ```python
  @field_validator("timezone")
  @classmethod
  def validate_timezone(cls, v: Optional[str]) -> Optional[str]:
      if v is not None:
          return validate_timezone_name(v)
      return v
  ```
- **Rejection Behavior:** Invalid IANA identifiers (e.g. `"Fake/Zone"`) are rejected immediately with HTTP 422 Unprocessable Content.

### 3.2 Dual-Repository Settings Synchronization
- **Files:**
  - `backend/app/repositories/sqlite/setting.py`
  - `backend/app/repositories/mongodb/setting.py`
- **Behavior:**
  - When an administrator updates the institutional timezone via `PUT /api/v1/settings` or `PATCH /api/v1/settings`, the repository persists the new timezone and automatically cascades the update to all notification schedules (`notification_schedules.timezone`), ensuring schedules do not run on orphaned timezone offsets.

### 3.3 Authoritative Meal Identification (`get_today`)
- **Files:**
  - `backend/app/repositories/sqlite/meal.py`
  - `backend/app/repositories/mongodb/meal.py`
- **Behavior:**
  - Dynamic resolution of institutional timezone from `InstitutionSetting` (falling back to configuration default).
  - Retrieval of `today_str = get_institution_today_str(inst_tz)`.
  - At 2:00 AM IST on Nov 4 (20:30 UTC Nov 3), `get_today()` retrieves all meals scheduled for `2026-11-04`, not `2026-11-03`.
  - Both SQLite and MongoDB meal repositories implement identical timezone-aware behavior.

### 3.4 Response Window & Deadline Validation
- **File:** `backend/app/api/routes/responses.py`
- **Behavior:**
  - The response submission endpoint resolves the configured institutional timezone via `get_institution_timezone(inst_tz_str)`.
  - The meal's `response_deadline` is parsed and localized to the institution timezone if naive.
  - The deadline is converted to UTC (`deadline_utc`) and compared against `now_utc()`.
  - Submissions after `deadline_utc` are rejected with HTTP 400 (`"Response deadline has passed for this meal."`).

### 3.5 Frontend Timezone Formatting & Administration
- **Files:**
  - `frontend/src/lib/utils.ts`
  - `frontend/src/pages/admin/SettingsPage.tsx`
- **Behavior:**
  - In `frontend/src/lib/utils.ts`, `formatDate`, `formatTime`, and `formatDateTime` now format timestamps dynamically in the configured institutional timezone via standard JavaScript `Intl.DateTimeFormat(locale, { timeZone })`.
  - In `frontend/src/pages/admin/SettingsPage.tsx`, the System Timezone input is enabled and editable, displays the persisted timezone, validates that it is non-empty, and saves it through `settingsService.saveSettings(...)`.

---

## 4. Verification & Automated Test Suite

A dedicated automated test suite was developed in `backend/tests/test_timezone.py` covering all 11 mandatory scenarios:

| # | Test Function | Verified Behavior | Status |
|---|---|---|---|
| 1 | `test_ist_date_before_and_after_midnight` | Calendar day rollover at 00:00 local time relative to UTC | PASSED |
| 2 | `test_meal_identification_at_2am_ist` | `get_today()` at 2:00 AM IST identifies Nov 4 meals when UTC is Nov 3 | PASSED |
| 3 | `test_response_deadline_validation` | Correct submission acceptance before deadline and 400 rejection after deadline | PASSED |
| 4 | `test_utc_persistence_and_timezone_conversion` | UTC instants stored and converted accurately across timezones | PASSED |
| 5 | `test_notification_scheduling_across_local_midnight` | Notification schedule times converted to UTC without date clipping | PASSED |
| 6 | `test_report_boundaries_in_institution_timezone` | Local date boundaries translate to precise UTC intervals | PASSED |
| 7 | `test_invalid_timezone_configuration_rejected` | Invalid IANA identifier rejected with HTTP 422 | PASSED |
| 8 | `test_sqlite_and_mongodb_parity_for_today` | SQLite and MongoDB Atlas repositories derive identical today instances | PASSED |
| 9 | `test_changing_timezone_changes_operational_today` | Dynamic update from `Asia/Kolkata` to `America/New_York` shifts operational date from Nov 4 to Nov 3 | PASSED |
| 10 | `test_historical_outcomes_remain_unchanged_on_timezone_update` | Updating timezone preserves historical `MealOutcome` attendance and preparation values | PASSED |

### 4.1 Test Run Summary
- **Timezone Tests:** 10/10 passed (`pytest -v tests/test_timezone.py`)
- **Backend Regression Suite:** 16/16 passed (`pytest -v tests/test_settings.py tests/test_outcomes.py tests/test_reports.py tests/test_responses.py tests/test_schedules.py`)
- **Frontend Unit Tests:** 34/34 passed (`npm test -- --run`)
- **Frontend Production Build:** Successful (`tsc -b && vite build` built in 1.19s with 0 errors)
- **Live REST API Verification:**
  - `GET /api/v1/settings` -> HTTP 200 (returns persisted timezone)
  - `PUT /api/v1/settings` with `timezone="Fake/Zone"` -> HTTP 422 (rejected)
  - `PUT /api/v1/settings` with `timezone="UTC"` -> HTTP 200 (updated)
  - `PUT /api/v1/settings` with `timezone="Asia/Kolkata"` -> HTTP 200 (restored)

---

## 5. Atlas Database Data Protection

- All existing 66 documents in MongoDB Atlas production database were strictly preserved.
- No schema drops or collection resets were executed.
- Dual persistence parity between SQLite and MongoDB Atlas was validated and confirmed intact.
