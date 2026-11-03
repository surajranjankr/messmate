# MessMate: Dynamic Data & Institutional Configuration Persistence Verification Report

**Date:** November 3, 2026  
**Scope:** Dynamic Demand Pipeline, Elimination of Hardcoded UI Artifacts, Persistent Institution Configuration, Multi-Portal Data Flow Alignment  
**Platforms:** FastAPI Backend (SQLite & MongoDB Atlas dual-persistence), React / Vite Frontend  

---

## 1. Executive Summary

This report documents the resolution of data inconsistencies, hardcoded values, and configuration persistence gaps across the MessMate system. 

Four primary visual anomalies were identified from user interface audits:
1. **`VendorOutcomesPage.tsx`:** "Actual Portions Prepared" defaulted to pre-filled `2` (the system recommendation), violating operational discipline. The historical outcomes log displayed hardcoded demo quantities (`756 portions, 710 students, 46 portions`).
2. **`VendorReportsPage.tsx`:** The "Recommended vs Planned vs Prepared" bar chart mixed live recommendations with hardcoded legacy seed data (`Nov 2, L: Planned: 756, Prepared: 756, Recommended: 2`), generating misleading operational comparisons.
3. **`AdminReportsPage.tsx`:** The "Comprehensive Meal Demand Log" was populated with static demo rows (`756 portions, 46 portions, 780 portions (planned)`) and omitted the required "Actual Attendance" column. Response coverage calculations also included a fallback to an illustrative 750 students.
4. **`SettingsPage.tsx`:** "Institution Configuration" operated purely via local React `useState('8')`. Changes to the Provisional Safety Margin reverted back to 8% upon navigation, reload, or session restart, and were completely disconnected from both the database and the demand calculation engine.

All issues have been resolved through an end-to-end refactoring:
- A database-backed **Institution Configuration** entity now persists administrative settings across SQLite and MongoDB Atlas.
- The **Dynamic Forecasting Engine** queries the database directly for the active safety margin $m$, computing $Q = \lceil F \times (1 + m) \rceil$ on live data.
- All vendor and admin reporting pages now consume reports asynchronously via backend API endpoints.
- All legacy hardcoded seed datasets have been purged from storage initialization.

---

## 2. Root Cause Analysis

| Component | Root Cause | Remediation Applied |
|---|---|---|
| `SettingsPage.tsx` | State stored only in React component memory; no backend endpoints, models, or repositories existed. | Created `InstitutionSetting` schema, models, repositories, and REST endpoints (`GET/PUT/PATCH /api/v1/settings`). Wired to full-stack `settingsService`. |
| `VendorOutcomesPage.tsx` | Line 79 set `setActualPrepared(String(decision?.finalPlannedQuantity ?? rec.recommendedPortions))`, pre-filling actuals. Log read from synchronous `outcomeService.getAllOutcomes()`. | Actuals input now initializes as empty string `''`. Added read-only contextual reference badges. Wired to `outcomeService.saveOutcomeAsync()` and `fetchAllOutcomes()`. |
| `VendorReportsPage.tsx` | Called synchronous `getMealReports()` and fell back to `r.recommendation.recommendedPortions` when `decision` was absent, mixing with legacy demo records. | Updated to async `fetchMealReports()`. Removed fallback to recommendation. Cleared legacy mock seed data. |
| `AdminReportsPage.tsx` | Missing `Actual Attendance` column in table. Used `r.counts.totalRegistered \|\| 750` in coverage percentage. | Added `Actual Attendance` column. Changed denominator to dynamic `totalRegistered`. Wired to `fetchMealReports()`. |
| `storage.ts` & `seedData.ts` | `generateDemoOutcomes()` and `generateDemoVendorDecisions()` hardcoded 756/710/46 into `localStorage`. | Sanitized seed collections to `[]` and added automatic cleanup of stale demo outcomes in `initializeStorageIfEmpty()`. |

---

## 3. Persistent Institution Configuration Architecture

### 3.1 Domain Model & Constraints
The institutional configuration is represented by the `InstitutionSetting` entity (singleton `id = "default"`):

- **`id` (str):** Primary identifier, `"default"`.
- **`institution_name` (str):** Institution display name (default: `"IIIT Dharwad"`).
- **`timezone` (str):** System timezone (default: `"Asia/Kolkata"`).
- **`safety_margin_fraction` (float):** Stored fraction $m \in [0.0, 0.50]$ (e.g., $0.08$ for 8%, $0.20$ for 20%).
- **`updated_at` (datetime):** UTC timestamp of last administrative modification.

Validation enforces $0\% \le m \le 50\%$:
- Values above 50% ($m > 0.50$) return HTTP 422 Unprocessable Entity.
- Negative values ($m < 0.0$) return HTTP 422 Unprocessable Entity.

### 3.2 Dual-Database Persistence
- **SQLite:** Implemented in `app/models/setting.py` and `app/repositories/sqlite/setting.py`. Automatically initializes the default row with 8% if missing.
- **MongoDB Atlas:** Implemented in `app/repositories/mongodb/setting.py` targeting the `institution_settings` collection (`_id: "default"`).
- **Dependency Injection:** Seamless backend selection via `get_settings_repository()` conditioned on `settings.DATABASE_BACKEND`.

### 3.3 API Endpoints & RBAC
Exposed under prefix `/api/v1/settings` in `app/api/routes/settings.py`:
- `GET /api/v1/settings`: Public/authenticated retrieval of system parameters.
- `PUT /api/v1/settings`: Complete update of parameters (Restricted to `ADMIN` role).
- `PATCH /api/v1/settings`: Partial update of parameters (Restricted to `ADMIN` role).

---

## 4. Forecasting Engine & Demand Formula Alignment

The forecasting engine calculates expected demand $F$ and recommended batch production $Q$ dynamically:

$$F = (D \times 1.0) + (P \times 0.5) + (R \times r_{\text{nonresp}})$$

$$Q = \lceil F \times (1 + m) \rceil$$

Where:
- $D$: Number of students who responded `DEFINITELY_EATING`.
- $P$: Number of students who responded `PROBABLY_EATING`.
- $R$: Number of active students who submitted no response (`NO_RESPONSE` $= T - (D + P + N)$).
- $r_{\text{nonresp}}$: Attendance rate among non-responders (default $0.70$, or calculated from historical outcomes).
- $m$: **Active provisional safety margin queried directly from `InstitutionSetting` in the database.**

### Dynamic Recalculation Verification:
When an administrator modifies the safety margin from 8% ($m = 0.08$) to 20% ($m = 0.20$):
- Baseline student demand $F = 2.7$ portions.
- With $m = 0.08$: $Q = \lceil 2.7 \times 1.08 \rceil = \lceil 2.916 \rceil = 3$ portions.
- With $m = 0.20$: $Q = \lceil 2.7 \times 1.20 \rceil = \lceil 3.24 \rceil = 4$ portions.
- The live endpoint `/api/v1/forecasts/recommendation/{meal_id}` immediately returned `safetyMarginFraction: 0.20` and `recommendedPortions: 4`.

---

## 5. Portal & Component Improvements

### 5.1 Admin Settings Portal (`SettingsPage.tsx`)
- Integrated `settingsService.fetchSettings()` on mount to load saved configuration.
- Two-way bound `safetyMargin` input to `safetyMarginPercentage`.
- Integrated `settingsService.saveSettings()` on form submission with async spinner and feedback alerts.
- Persists across page navigation, browser reload, logout/login, and backend server restarts.

### 5.2 Vendor Outcomes Portal (`VendorOutcomesPage.tsx`)
- Input field `Actual Portions Prepared` now initializes strictly to `''` when no outcome is recorded.
- Contextual Planning Reference badge displays read-only `System Recommendation` and `Confirmed Planned Batch` above the form.
- Form submissions call `outcomeService.saveOutcomeAsync()` to sync directly with `/api/v1/outcomes/{meal_id}`.
- Unrecorded past meals display `"Not recorded"` / `"Not measured"` / `"Unmeasured"` rather than false demo metrics.

### 5.3 Vendor Reports Portal (`VendorReportsPage.tsx`)
- Replaced synchronous local storage reads with `await reportService.fetchMealReports(filters)`.
- Replaced fallback logic that defaulted planned portions to recommendations when unrecorded.
- Purged legacy 756/710/46 demo seed data.

### 5.4 Admin Demand Log Portal (`AdminReportsPage.tsx`)
- Replaced synchronous reads with `await reportService.fetchMealReports(filters)`.
- Replaced hardcoded fallback `|| 750` with dynamic active student registration counts.
- Added explicit **`Actual Attendance`** column to both table header and body.
- Displays explicit `" — "` badge for unrecorded actuals, clearly distinguishing absence of measurement from numerical zero.

---

## 6. Verification Results

### 6.1 Backend Automated Test Suite
- `tests/test_settings.py`: **4 / 4 PASSED**
  - `test_get_settings_default`: Verified default 8% initialization and display name.
  - `test_update_settings_validation`: Verified rejection of values $> 50\%$ and $< 0\%$.
  - `test_update_settings_success_and_forecast_impact`: Verified persistence of 20% margin and immediate recommendation recalculation.
  - `test_student_cannot_update_settings`: Verified RBAC enforcement (403 Forbidden for students).
- `tests/test_forecast_engine.py` (Scenarios 1–15): **15 / 15 PASSED**
  - Invariants, non-response rate fallback hierarchy, zero population, deduplication, and single safety margin application verified.
- Route Integration Suite (`test_outcomes.py`, `test_reports.py`, `test_responses.py`, `test_schedules.py`): **16 / 16 PASSED**

### 6.2 Frontend Automated Test Suite
- Vitest suite: **34 / 34 PASSED** across 9 test files.
- TypeScript compilation and production build (`npm run build`): **PASSED** with 0 errors.

### 6.3 Live End-to-End API Verification
Executed against live uvicorn server (`http://127.0.0.1:8000`):
```text
Admin Login: 200 ADMIN
Initial Settings: safetyMarginPercentage = 8.0, safetyMarginFraction = 0.08
Updated Settings to 20%: safetyMarginPercentage = 20.0, safetyMarginFraction = 0.20
Live recommendation with 20% margin -> safetyMarginFraction: 0.20, recommendedPortions: 4
Meal Reports retrieved dynamically from DB: count = 28
  Sample Report Row: DINNER 2026-11-07, Counts: {'definitelyEating': 0, 'probablyEating': 0, 'notEating': 0, 'noResponse': 3, 'totalRegistered': 3}
Restored Settings to 8%: safetyMarginPercentage = 8.0, safetyMarginFraction = 0.08
Vendor Login: 200 VENDOR
Outcome saved status: 200, Actual prepared: 3
Total recorded outcomes: 4
```

---

## 7. Conclusion & Readiness

All hardcoded quantities and illustrative defaults have been eliminated. Every operational quantity on the Student, Vendor, and Admin portals now flows dynamically from database records. Institutional safety margin configurations persist reliably in the database and govern real-time kitchen preparation forecasting.

The MessMate persistence and data flow layer is completely unified and ready for subsequent production deployment and UI polish.
