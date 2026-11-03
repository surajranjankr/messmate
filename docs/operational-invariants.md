# MessMate Operational Invariants

**Version:** 1.0.0  
**Authority:** Core Architectural Directive  
**Date:** November 3, 2026  

This document defines the non-negotiable operational invariants of the MessMate platform. Future developers, automated agents, and contributors must strictly preserve these rules across both SQLite and MongoDB backends, all API routes, and all frontend portals.

---

## 1. Student Population Invariant
$$T = \text{COUNT}(\text{DISTINCT eligible student account IDs})$$

1. **Eligibility Rule:** An account contributes to the eligible student population $T$ if and only if:
   - `role == "STUDENT"`
   - `status == "ACTIVE"`
2. **Exclusion Rule:** The denominator $T$ must NEVER include:
   - Vendor accounts (`role == "VENDOR"`)
   - Administrator accounts (`role == "ADMIN"`)
   - Inactive / deactivated accounts (`status == "INACTIVE"`)
   - Pending / rejected registration accounts
   - Duplicate records
3. **No Hardcoded Denominator:** There must NEVER exist a hardcoded population constant (e.g. 700, 750, or fallback baseline) in operational forecasting or reporting. $T$ must be queried dynamically from the authoritative user repository.

---

## 2. Response Counting & Denominator Invariant
For every individual meal instance $m$:
$$T = D_m + P_m + N_m + R_m$$
Where:
- $D_m$ = Unique eligible active students responding `DEFINITELY_EATING`
- $P_m$ = Unique eligible active students responding `PROBABLY_EATING`
- $N_m$ = Unique eligible active students responding `NOT_EATING`
- $S_m = D_m + P_m + N_m$ (Total responded eligible students)
- $R_m = \max(0, T - S_m)$ (Authoritative No-Response count)

1. **Single Current Response:** Enforce at most one current response per student per meal instance. Re-submitting updates the record in-place; duplicate response rows are prohibited.
2. **Strict Meal Partitioning:** A response to one meal (e.g. Breakfast) must NEVER influence another meal (e.g. Lunch), and responses for date $X$ must NEVER influence date $Y$.
3. **Deactivated Accounts:** If a student submitted a response and is subsequently deactivated:
   - Their historical row remains in storage for audit preservation.
   - Their ID is excluded from the active eligible cohort ($T$ decreases by 1).
   - Their response is excluded from $D_m, P_m, N_m$.
   - The invariant $T = D_m + P_m + N_m + R_m$ remains mathematically true.

---

## 3. Response Window & Deadline Invariant
For every meal instance, responses are permitted if and only if:
$$\text{opening\_time} \le \text{current\_time} < \text{closing\_time}$$

1. **Before Opening Time ($\text{current\_time} < \text{opening\_time}$):**
   - Operational Status: `UPCOMING`
   - State: **REJECTED — NOT OPEN**
   - HTTP Status: `400 Bad Request`
   - Tomorrow's meals must NEVER accept early responses simply because the meal instance row exists in the database.
2. **During Open Window ($\text{opening\_time} \le \text{current\_time} < \text{closing\_time}$):**
   - Operational Status: `RESPONSE_OPEN`
   - State: **ALLOWED** (both new submissions and modifications)
   - HTTP Status: `200 OK`
3. **At or After Closing Time ($\text{current\_time} \ge \text{closing\_time}$):**
   - Operational Status: `RESPONSE_CLOSED`
   - State: **REJECTED — DEADLINE PASSED**
   - HTTP Status: `400 Bad Request`
   - No creation or modification is permitted after closing.
4. **Backend Authority:** The FastAPI backend is the ultimate authority. Direct requests via curl, Postman, or script MUST be validated identically to UI clicks.

---

## 4. Timezone & Physical Instant Standard
1. **Physical Instant Storage:** All timestamps in SQLite and MongoDB Atlas must be stored and transmitted as UTC ISO 8601 strings (`...Z` or `...+00:00`).
2. **Operational Timezone:** Human-facing calendar dates, daily meal rollover at midnight, notification schedules, and local opening/closing hours must be evaluated dynamically in the configured institutional timezone (`InstitutionSetting.timezone`, e.g. `Asia/Kolkata`).
3. **Strict Comparison Rule:** Datetime comparisons must occur between timezone-aware instants in UTC (`now_utc >= close_utc`). Naive datetime comparisons are forbidden.

---

## 5. Demand Forecasting Invariant
$$F = D + (0.5 \times P) + (r \times R)$$
$$Q = \lceil F \times (1 + m) \rceil$$
Where:
- $D, P, R$ are the exact meal-specific response counts for active eligible students.
- $r$ is the empirical nonresponse attendance rate derived from completed meals with recorded headcount outcomes (or configured institutional fallback).
- $m$ is the persisted institutional safety margin fraction (`InstitutionSetting.safety_margin_fraction`).
- Not Eating ($N$) contributes exactly zero demand.
- If $T = 0$, $F = 0$ and $Q = 0$.
- If $R > 0$ and historical/configured rate $r$ is unavailable, $Q$ must remain `None` (`INSUFFICIENT`). The system must NEVER fabricate an arbitrary recommendation.

---

## 6. Audit Preservation & Separation of Concerns
1. **Recommendation:** The formula-derived recommendation $Q$ is stored permanently in `ForecastRecommendation`.
2. **Vendor Decision:** The vendor's final planned preparation batch is stored in `VendorDecision`. Overrides (`planned_quantity != original_recommendation`) preserve the original recommendation $Q$ alongside the override justification.
3. **Measured Outcome:** Physical kitchen outcomes are recorded in `MealOutcome`:
   - Headcount attendance: in students.
   - Prepared food: in portions.
   - Leftovers: in kg or portions.
4. **No Fabricted Data:** When an outcome has not been recorded by kitchen staff, reports and dashboards must display `"Not recorded"`. Fabricated or illustrative demo values must NEVER be presented as genuine institutional measurements.
