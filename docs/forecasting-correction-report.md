# MessMate: Dynamic Meal Preparation Forecasting Correction Report

**Executive Summary:**
A critical flaw in the forecasting pipeline caused the Mess Vendor Dashboard to display fixed illustrative values (700 baseline students, 8% safety margin, 756 portions) regardless of the actual active student population or student response counts. This report documents the end-to-end diagnosis, architectural remediation, mathematical implementation of the weighted demand forecasting model, repository refactoring across both SQLite and MongoDB Atlas, frontend UI operational updates, and verification across 16 formal test scenarios.

---

## 1. Root Cause Analysis

Tracing the forecasting pipeline from UI to database revealed four disconnected layers where hardcoded values and static fallbacks persisted:

1. **Configuration Defaults (`backend/app/core/config.py`):**
   - `DEFAULT_BASELINE_ATTENDANCE = 700` and `TOTAL_REGISTERED_STUDENTS = 750` were defined as system constants.
   - Nonresponse attendance rates were not modeled as configurable domain settings.

2. **Database Repositories (`SqliteForecastRepository` & `MongoForecastRepository`):**
   - The forecast repositories computed $F = B$ using only total active student count without querying meal response choices ($D, P, N$) or computing unresponded students ($R$).
   - Existing MongoDB Atlas `meal_instances` documents contained static legacy embedded recommendations (`{"baseline_attendance": 700, "recommended_portions": 756}`), which `get_recommendation()` returned verbatim if present.

3. **Frontend Services & Seed Cache (`forecastService.ts`, `seedData.ts`):**
   - `forecastService.getRecommendation()` computed $F = B$ synchronously from local storage and returned cached demo recommendations containing 756 portions.
   - `seedData.ts` seeded demo vendor decisions and forecasts with 700 / 756.

4. **Frontend UI Components (`VendorDashboard.tsx`, `VendorPlanningPage.tsx`):**
   - `VendorDashboard.tsx` included a static banner explicitly quoting: *"Attendance recommendations are based on an illustrative vendor baseline of 700 students plus an 8% safety margin (756 portions)."*
   - Cohort totals defaulted to `750` when loading.

---

## 2. Mathematical Demand Model Formulation

The corrected forecasting pipeline derives expected attendance $F$ and recommended preparation $Q$ strictly from database entities:

### 2.1 Student Population and Response Partitioning
For any given meal instance $M$:
- Let $T$ be the total count of active students (`role == "STUDENT"` and `status == "ACTIVE"`). Inactive students and non-student roles are strictly excluded.
- Let $D$ be the count of unique active students choosing `DEFINITELY_EATING` (weight $w_D = 1.0$).
- Let $P$ be the count of unique active students choosing `PROBABLY_EATING` (weight $w_P = 0.5$).
- Let $N$ be the count of unique active students choosing `NOT_EATING` (weight $w_N = 0.0$).
- Let $R$ be the count of non-responding active students:
  $$R = \max(0, T - (D + P + N))$$
- **Cohort Invariant:** $T = D + P + N + R$ is guaranteed at all times.

### 2.2 Nonresponse Attendance Rate Probability Priority
The probability rate $\alpha \in [0.0, 1.0]$ for non-responders is determined via a 3-tier hierarchy:
1. **Tier 1 (Historical Derivation):** Evaluated from past completed meals with recorded `MealOutcome.actual_attendance` (prioritizing the same `meal_type`):
   $$\alpha = \frac{\sum_{k} \max\left(0, \min(R_k, \text{actual\_attendance}_k - (D_k \cdot 1.0 + P_k \cdot 0.5))\right)}{\sum_{k} R_k}$$
   If $\sum R_k > 0$, $\alpha$ is clamped to $[0.0, 1.0]$ with source `HISTORICAL`.
2. **Tier 2 (Configured Administrator Fallback):** If no valid historical outcomes exist, fallback to `settings.DEFAULT_NONRESPONSE_ATTENDANCE_RATE` (default $0.70$ / $70\%$) with source `CONFIGURED_FALLBACK`.
3. **Tier 3 (Insufficient Data State):** If no historical outcomes exist and `DEFAULT_NONRESPONSE_ATTENDANCE_RATE is None`, the data status is flagged `INSUFFICIENT`:
   $$F = (D \cdot 1.0) + (P \cdot 0.5), \quad Q = \text{None}$$
   Vendor is prompted: *"Insufficient response history to generate a reliable preparation recommendation. Please enter a manual preparation quantity."*

### 2.3 Preparation Recommendation
When data is sufficient or fallback is applied:
$$\text{Expected Attendance } F = (D \cdot 1.0) + (P \cdot 0.5) + (R \cdot \alpha)$$
$$\text{Recommended Preparation } Q = \lceil F \cdot (1 + m) \rceil \quad (\text{if } F > 0 \text{ else } 0)$$
where $m = \text{settings.DEFAULT\_SAFETY\_MARGIN} = 0.08$ ($8\%$). The safety margin is applied exactly once to aggregate expected demand $F$.

---

## 3. Dual-Database Implementation Architecture

Both persistence engines implement `IForecastRepository` with identical business logic and zero route-level queries:

```
FastAPI Router (/forecasts)
         │
         ▼
  IForecastRepository (Abstract Interface)
         ├── SqliteForecastRepository   (SQLAlchemy: User, MealResponse, MealOutcome, MealInstance)
         └── MongoForecastRepository    (Motor Async: users, meal_responses, meal_instances)
```

### Production MongoDB Atlas Protection
- To honor the strict requirement of preserving all 66 existing documents in production MongoDB Atlas (`messmate`), read queries compute dynamic forecasts on-the-fly and return `ForecastRecommendationSchema` without issuing mutating updates to production Atlas collections.
- Mutating tests run against the isolated test database `messmate_forecast_test` / `messmate_write_test`, ensuring zero contamination of production Atlas data.

---

## 4. Vendor Override Workflow & Data Separation

The separation of forecast recommendations and vendor operational decisions is maintained across both databases:

| Concern | Database Field | Behavior |
|---|---|---|
| **System Recommendation** | `ForecastRecommendation.recommended_portions` | Dynamic, derived strictly from $T, D, P, R, \alpha, m$ |
| **Vendor Planned Quantity** | `VendorDecision.final_planned_quantity` | Input by vendor |
| **Audit Status** | `VendorDecision.status` | `ACCEPTED` if equal to $Q$, `OVERRIDDEN` if modified |
| **Override Justification** | `VendorDecision.override_reason` | Required when overriding $Q$ |
| **Original Baseline** | `VendorDecision.original_recommendation` | Persisted and preserved immutably |

Actual headcounts (`actual_attendance`) and leftover quantities (`leftover_quantity`) recorded in `MealOutcome` post-meal do not overwrite, mutate, or erase forecast recommendations or vendor decisions.

---

## 5. Frontend Operational UI Enhancements

1. **Vendor Dashboard (`VendorDashboard.tsx`):**
   - Removed the obsolete static demonstration notice banner.
   - Added asynchronous synchronization with backend `/forecasts/recommendation/{id}` and `/responses/counts/{id}`.
   - Updated Recommendation Box to display:
     - Portion recommendation with expected demand subtitle: `{rec.recommendedPortions} Portions recommended (Expected demand {rec.expectedAttendance} + 8% safety margin)`.
     - Graceful handling of `INSUFFICIENT` data quality status with clear manual entry prompt and warning badge.
   - Cohort totals display dynamic registered active students count (`totalRegistered`).

2. **Vendor Planning Page (`VendorPlanningPage.tsx`):**
   - Displays complete dynamic demand formula breakdown: Eligible Students ($T$), Expected Demand ($F$), Safety Margin ($m$), and Recommended Portions ($Q$).
   - Asynchronously synchronizes live backend recommendation and confirmed vendor decisions.
   - For `INSUFFICIENT` status, leaves the quantity input unpopulated to mandate explicit vendor input without misleading defaults.

3. **Client Forecasting Service (`forecastService.ts`):**
   - Updated local dynamic calculation to mirror backend demand formula: $F = (D \cdot 1.0) + (P \cdot 0.5) + (R \cdot 0.70)$, $Q = \lceil F \cdot 1.08 \rceil$.

---

## 6. Verification & Test Suite Execution

A dedicated test suite `backend/tests/test_forecast_engine.py` was constructed to validate all 16 operational scenarios:

| # | Test Scenario | Verified Condition | Status |
|---|---|---|---|
| 1 | 3 active students, all No Response, 70% rate | $D=0, P=0, N=0, R=3 \implies F=2.1, Q=3$ | **PASS** |
| 2 | Balanced responses (1 Def, 1 Prob, 1 Not Eating) | $D=1, P=1, N=1, R=0 \implies F=1.5, Q=2$ | **PASS** |
| 3 | All active students Definitely Eating | $D=3, P=0, N=0, R=0 \implies F=3.0, Q=4$ | **PASS** |
| 4 | All active students Not Eating | $D=0, P=0, N=3, R=0 \implies F=0.0, Q=0$ | **PASS** |
| 5 | Zero eligible active students | $T=0 \implies F=0.0, Q=0$, status = `ZERO_POPULATION` | **PASS** |
| 6 | No history + configured fallback is None | $R=3, \text{rate}=\text{None} \implies Q=\text{None}$, status = `INSUFFICIENT` | **PASS** |
| 7 | Configured fallback rate applied | Configured fallback (e.g. 0.50) applied when no history exists | **PASS** |
| 8 | Historical rate priority over fallback | Historical rate (0.50) derived from completed meals overrides 0.70 default | **PASS** |
| 9 | Safety margin applied once | $Q = \lceil F \cdot (1 + m) \rceil$ applied exactly once to aggregate demand | **PASS** |
| 10 | Vendor override preservation | Original recommendation preserved, status = `OVERRIDDEN` | **PASS** |
| 11 | Actual attendance isolation | Adding `MealOutcome.actual_attendance` does not mutate forecast | **PASS** |
| 12 | Leftovers isolation | Leftover weights do not overwrite planned batch quantities | **PASS** |
| 13 | Meal independence | Distinct meals have independent counts, deadlines, and forecasts | **PASS** |
| 14 | Exclusion of inactive and non-students | Inactive students and vendor/admin roles excluded from baseline and counts | **PASS** |
| 15 | Student response deduplication | Duplicate or updated responses do not inflate counts ($T = D+P+N+R$) | **PASS** |
| 16 | SQLite and MongoDB equivalence | Identical inputs produce identical $T, D, P, N, R, F, Q$ across both engines | **PASS** |

### Complete Verification Suite Summary

- **Backend Pytest Suite:** **108 passed** (100% passing across 15 test modules).
- **Frontend Test Suite:** **34 passed** (100% passing across 9 test files).
- **Frontend Build (`tsc -b && vite build`):** **0 errors** (Production bundle generated).
- **Full-Stack End-to-End Verification (`verify_integration.py`):** **14/14 checkpoints passed**.
- **MongoDB Atlas Production Database Audit:** **66/66 documents strictly preserved** (0 deleted, 0 corrupted).
