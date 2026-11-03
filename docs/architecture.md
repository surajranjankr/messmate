# MessMate Architecture & Design Document (Full-Stack Phase 2)

---

## 1. Architectural Philosophy

MessMate is designed as a **frugal innovation solution** for institutional food demand forecasting and waste reduction at IIIT Dharwad.

In **Phase 2**, the architecture transitions from browser-local persistence to a resilient, full-stack decoupled architecture consisting of a **React 19 SPA frontend** communicating over REST HTTP with a **FastAPI backend** backed by persistent **SQLite**.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                      │
│   (TypeScript, Vite, Tailwind CSS, Radix UI, Lucide Icons)  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                     UI Pages                        │   │
│   │   StudentDashboard, VendorPlanning, AdminDashboard  │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │               9 Domain Services                     │   │
│   │  authService, menuService, responseService, etc.    │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                 apiClient (Fetch)                   │   │
│   │   JWT bearer attachment, 401 handler, offline sync  │   │
│   └──────────────────────────┬──────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────┘
                               │ HTTP / JSON
                               │ (CORS: localhost:5173)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                        │
│   (Python 3.13 / Uvicorn ASGI Server at /api/v1)            │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │               FastAPI Route Routers                 │   │
│   │  /auth, /users, /menus, /meals, /responses,         │   │
│   │  /schedules, /forecasts, /outcomes, /reports        │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           Dependencies & Domain Business Rules      │   │
│   │  - PyJWT Bearer Auth & Direct Bcrypt Verification   │   │
│   │  - Server-side UTC Deadline Enforcement             │   │
│   │  - Strictly separate No Response from Not Eating    │   │
│   │  - Preserve original formula recommendation         │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │        SQLAlchemy 2.0 ORM & SQLite Persistence      │   │
│   │  Tables: users, menu_versions, menu_meal_entries,   │   │
│   │          dish_items, meal_instances, meal_responses,│   │
│   │          notification_schedules, forecasts,         │   │
│   │          vendor_decisions, meal_outcomes, notifs    │   │
│   │  Database File: backend/data/messmate.db            │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Domain Models & Database Tables

1. **User (`users` table):**
   - Columns: `id`, `display_name`, `email` (unique), `hashed_password`, `role` (`STUDENT`, `VENDOR`, `ADMIN`), `status` (`ACTIVE`, `INACTIVE`).
2. **MenuVersion (`menu_versions` table):**
   - Columns: `id`, `version_number`, `status` (`DRAFT`, `PUBLISHED`, `ARCHIVED`), `created_at`, `published_at`, `change_summary`.
3. **MenuMealEntry (`menu_meal_entries` table):**
   - Columns: `id`, `menu_version_id` (FK), `day_of_week`, `meal_type`, `accompaniments` (JSON), `notes` (JSON).
4. **DishItem (`dish_items` table):**
   - Columns: `id`, `menu_meal_entry_id` (FK), `name`, `alternatives` (JSON), `category`.
5. **MealInstance (`meal_instances` table):**
   - Columns: `id` (`mi-YYYY-MM-DD-type`), `meal_date`, `meal_type`, `menu_version_id`, `response_deadline`, `status` (`UPCOMING`, `RESPONSE_OPEN`, `RESPONSE_CLOSED`, `COMPLETED`).
6. **MealResponse (`meal_responses` table):**
   - Columns: `id`, `student_id` (FK), `meal_instance_id` (FK), `choice` (`DEFINITELY_EATING`, `PROBABLY_EATING`, `NOT_EATING`), `created_at`, `updated_at`.
   - **Constraint:** Unique `(student_id, meal_instance_id)` guarantees exactly one response per student per meal.
7. **ForecastRecommendation (`forecast_recommendations` table):**
   - Columns: `id`, `meal_instance_id` (FK), `baseline_attendance` ($B=700$), `expected_attendance` ($F=700$), `safety_margin_fraction` ($m=0.08$), `recommended_portions` ($Q=756$), `forecast_method`, `data_quality_status`, `explanation`, `created_at`.
8. **VendorDecision (`vendor_decisions` table):**
   - Columns: `id`, `meal_instance_id` (FK), `original_recommendation` ($756$), `final_planned_quantity` (e.g. $740$), `override_reason`, `status` (`ACCEPTED`, `OVERRIDDEN`), `updated_at`.
   - **Invariant:** Original recommendation is strictly preserved when an override occurs.
9. **MealOutcome (`meal_outcomes` table):**
   - Columns: `id`, `meal_instance_id` (FK), `actual_attendance` (students), `actual_prepared_quantity` (portions), `prepared_unit`, `leftover_quantity`, `leftover_unit` (`kg` or `portions`), `notes`, `recorded_at`.
10. **NotificationSchedule (`notification_schedules` table):**
    - Columns: `id`, `day_of_week`, `meal_type`, `enabled`, `notify_send_time`, `response_deadline_time`, `meal_date_offset`, `timezone` (`Asia/Kolkata`), `overlap_acknowledged`.
    - Exactly 28 default configurations representing all meal slots across the week.
11. **Notification (`notifications` table):**
    - Columns: `id`, `title`, `message`, `is_read`, `created_at`, `meal_instance_id`.

---

## 3. Critical Business Invariants

### A. Response Deadlines
- Responses and response changes are rejected after the deadline.
- Evaluated on the server using UTC timestamps (`datetime.now(timezone.utc)` vs `meal.response_deadline`).
- Tampering with the client clock cannot submit responses after cutoff.

### B. Aggregate Counts Integrity
- In vendor views:
  $$\text{Total Responded} = \text{Definitely} + \text{Probably} + \text{Not Eating}$$
  $$\text{No Response} = \max(0, \text{Total Registered (750)} - \text{Total Responded})$$
- `No Response` is **never** added to `Not Eating`.

### C. Recommendation Formula & Audit Trail
- Baseline formula:
  $$F = B = 700, \quad Q = \lceil F \times (1 + m) \rceil = \lceil 700 \times 1.08 \rceil = 756 \text{ portions}$$
- If a vendor overrides $Q$ to 740 with a reason, the record preserves $Q_{\text{original}} = 756$, $Q_{\text{final}} = 740$, and the justification for audits.

### D. Single Response per Student
- A student submitting multiple times updates their existing record.
- No duplicate records are created.

### E. Privacy
- Students can only view their own meal intention history.
- Vendors and admins see aggregate counts, never individually identified student choices.

---

## 4. Phase 3: MongoDB Document Architecture & External Integrations

### A. Dual-Engine Persistence Abstraction
MessMate supports configurable database backends via `DATABASE_BACKEND`:
- `sqlite`: Local development & instant rollback engine using SQLite file storage (`backend/data/messmate.db`).
- `mongodb`: Scalable cloud persistence engine targeting MongoDB Atlas clusters with connection pooling via Motor.

### B. MongoDB Document Collections
1. `users`: Indexed on `email` (unique).
2. `menu_versions`: Embeds the complete 28-meal and 108-dish hierarchy for atomic reads.
3. `meal_instances`: Embeds `recommendation`, `vendor_decision`, and `outcome` subdocuments. Missing measurements remain null.
4. `meal_responses`: Referenced collection with a unique compound index on `(student_id, meal_instance_id)` enforcing high-concurrency write isolation and one response per student per meal.
5. `notification_schedules`: Indexed on `(day_of_week, meal_type)`.
6. `notifications`: Indexed on `(user_id, is_read)`.

### C. Modular External Integrations
- **Email (Resend):** Modular adapter under `backend/app/integrations/email/` supporting `ResendClient` and `MockEmailClient`. Unconfigured keys gracefully report status without application crashes.
- **WhatsApp:** Interface defined under `backend/app/integrations/whatsapp/client.py`; delivery deferred per Phase 3 specifications while in-app notifications remain active.

