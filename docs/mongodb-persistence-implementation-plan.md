# MessMate: MongoDB Persistence Layer — Architecture & Implementation Plan

---

## 1. Current Architecture Overview

MessMate currently features a decoupled React 19 SPA frontend communicating over REST HTTP with a FastAPI backend. 

```text
┌─────────────────────────────────────────────────────────────────┐
│                    React 19 Frontend (SPA)                      │
│      TypeScript, Vite, Tailwind CSS, Lucide, Radix UI           │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │   9 Domain Services + apiClient.ts (Bearer JWT Auth)    │   │
│   └────────────────────────────┬────────────────────────────┘   │
└────────────────────────────────┼────────────────────────────────┘
                                 │ HTTP REST (JSON)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (/api/v1)                    │
│   Routers: /auth, /users, /menus, /meals, /responses,           │
│            /schedules, /forecasts, /outcomes, /reports          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   Current Dependency                    │   │
│   │               db: Session = Depends(get_db)             │   │
│   └────────────────────────────┬────────────────────────────┘   │
│                                │                                │
│                                ▼                                │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 SQLAlchemy 2.0 ORM Engine               │   │
│   │                 backend/data/messmate.db                │   │
│   │               [HARD-WIRED SQLite TARGET]                │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │               MongoDB Atlas (Motor 3.7.1)               │   │
│   │               Target: messmate database                 │   │
│   │               [ONLY PROBED BY /health]                  │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Root Cause of the Routing Gap

A complete pre-implementation audit of all ten FastAPI router files (`auth.py`, `users.py`, `menus.py`, `meals.py`, `responses.py`, `schedules.py`, `forecasts.py`, `outcomes.py`, `reports.py`, `notifications.py`) identified the following root causes:

1. **Direct SQLAlchemy Invocations:** Exactly **56 occurrences of `db.query(...)`** are hard-coded into route handler bodies.
2. **Hard-coded Dependency Injection:** Every endpoint relies on `db: Session = Depends(get_db)`. In [backend/app/db/session.py](file:///C:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/db/session.py), `get_db()` exclusively yields an SQLite SQLAlchemy `SessionLocal`.
3. **Authentication Coupling:** [backend/app/dependencies/auth.py](file:///C:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/dependencies/auth.py) injects `db: Session = Depends(get_db)` and calls:
   ```python
   user = db.query(User).filter(User.id == user_id, User.status == "ACTIVE").first()
   ```
   This means every authenticated request looks up user credentials in SQLite, never MongoDB Atlas.
4. **Isolated MongoDB Configuration:** In [backend/app/main.py](file:///C:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/main.py), `DATABASE_BACKEND == "mongodb"` only triggers index initialization on startup and connectivity checks inside `/health`. No router was refactored to read or write to MongoDB collections.

---

## 3. Proposed Dual-Database Repository Architecture

To achieve clean, non-silent dual-database persistence where business logic is shared and testable, we propose a **Repository Pattern with Dependency Inversion**:

```text
┌─────────────────────────────────────────────────────────────────┐
│                       FastAPI Routers                           │
│        (auth, users, menus, meals, responses, reports)          │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Injects
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Service Layer                       │
│    (MenuService, ResponseEngine, ForecastCalculator, etc.)      │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Delegates to
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Repository Interfaces                       │
│  (IUserRepository, IMenuRepository, IMealRepository, etc.)     │
└──────────────────┬───────────────────────────┬──────────────────┘
                   │                           │
    If DATABASE_BACKEND=sqlite                 │ If DATABASE_BACKEND=mongodb
                   │                           │
                   ▼                           ▼
┌──────────────────────────────────┐ ┌──────────────────────────────────┐
│      SQLite Repositories         │ │      MongoDB Repositories        │
│   (SqliteUserRepository, etc.)   │ │   (MongoUserRepository, etc.)    │
│   Using SQLAlchemy 2.0 ORM       │ │   Using Motor / PyMongo Async    │
└──────────────────┬───────────────┘ └─────────────────┬────────────────┘
                   │                                   │
                   ▼                                   ▼
        backend/data/messmate.db             MongoDB Atlas (messmate)
```

### Architectural Principles:
1. **Explicit Backend Binding:** When `DATABASE_BACKEND=mongodb`, dependency injection provides MongoDB repository implementations. When `DATABASE_BACKEND=sqlite`, it provides SQLite repository implementations.
2. **Zero Silent Fallback:** If MongoDB Atlas experiences network latency, timeout, or authentication failure, the application returns HTTP 503 / 500. It **never** silently falls back to SQLite in production.
3. **Shared Business Invariants:** Logic such as calculating unresponded students ($\max(0, N_{\text{total}} - \sum \text{Responded})$), deadline enforcement ($t_{\text{now}} < t_{\text{deadline}}$), and forecast portion safety margins ($Q = \lceil F \times (1 + m) \rceil$) resides in shared service/model helpers, not duplicated inside database queries.

---

## 4. Repository Interfaces & Specifications

All repository methods will be defined as **asynchronous** (`async def`). For SQLite implementations, synchronous SQLAlchemy calls are executed cleanly within worker threads via `anyio.to_thread.run_sync` or synchronous session delegates, while MongoDB implementations natively await Motor/PyMongo coroutines.

### 4.1. `IUserRepository`
- `async def get_by_id(user_id: str) -> Optional[UserOut]`
- `async def get_by_email(email: str) -> Optional[UserWithSecret]` (contains `hashed_password` for auth verification)
- `async def list_users() -> List[UserOut]`
- `async def create_user(user: UserCreate) -> UserOut`
- `async def update_status(user_id: str, status: str) -> Optional[UserOut]`

### 4.2. `IMenuRepository`
- `async def get_published_menu() -> Optional[MenuVersionDetailSchema]`
- `async def get_draft_menu() -> Optional[MenuVersionDetailSchema]`
- `async def create_draft_menu(draft: MenuVersionCreate) -> MenuVersionDetailSchema`
- `async def publish_menu(version_id: str) -> MenuVersionDetailSchema`
- `async def delete_draft_menu() -> bool`
- `async def get_menu_history() -> List[MenuVersionSummarySchema]`
- `async def get_meal_entry(day_of_week: str, meal_type: str) -> Optional[MenuMealEntrySchema]`

### 4.3. `IMealRepository`
- `async def get_all_meals() -> List[MealInstanceSchema]`
- `async def get_today_meals(date_str: str) -> List[MealInstanceSchema]`
- `async def get_actionable_meal(now_iso: str) -> Optional[MealInstanceSchema]`
- `async def get_meal_by_id(meal_id: str) -> Optional[MealInstanceSchema]`
- `async def update_meal_status(meal_id: str, new_status: str) -> Optional[MealInstanceSchema]`

### 4.4. `IResponseRepository`
- `async def get_student_response(student_id: str, meal_id: str) -> Optional[MealResponseSchema]`
- `async def submit_response(student_id: str, meal_id: str, choice: str) -> MealResponseSchema`
- `async def get_student_history(student_id: str) -> List[MealResponseSchema]`
- `async def get_meal_counts(meal_id: str, total_registered: int) -> MealCountsSchema`

### 4.5. `IForecastRepository`
- `async def get_recommendation(meal_id: str) -> Optional[ForecastRecommendationSchema]`
- `async def save_recommendation(meal_id: str, rec: ForecastRecommendationSchema) -> ForecastRecommendationSchema`
- `async def get_vendor_decision(meal_id: str) -> Optional[VendorDecisionSchema]`
- `async def save_vendor_decision(meal_id: str, decision: VendorDecisionCreate, original_rec: int) -> VendorDecisionSchema`

### 4.6. `IOutcomeRepository`
- `async def get_outcome(meal_id: str) -> Optional[MealOutcomeSchema]`
- `async def get_all_outcomes() -> List[MealOutcomeSchema]`
- `async def save_outcome(meal_id: str, outcome: MealOutcomeCreate) -> MealOutcomeSchema`

### 4.7. `IScheduleRepository`
- `async def get_all_schedules() -> List[NotificationScheduleSchema]`
- `async def update_schedule(schedule_id: str, updates: dict) -> Optional[NotificationScheduleSchema]`
- `async def acknowledge_overlap(schedule_id: str) -> Optional[NotificationScheduleSchema]`

### 4.8. `INotificationRepository`
- `async def get_user_notifications(user_id: str) -> List[NotificationSchema]`
- `async def get_unread_count(user_id: str) -> int`
- `async def mark_as_read(notification_id: str, user_id: str) -> Optional[NotificationSchema]`
- `async def mark_all_read(user_id: str) -> int`

### 4.9. `IReportRepository`
- `async def get_dashboard_summary() -> DashboardSummarySchema`
- `async def get_meal_reports(filters: dict) -> List[MealReportEntrySchema]`

---

## 5. Driver Strategy Assessment: Motor vs. PyMongo Async

We analyzed our installed environment (`pymongo==4.19.0`, `motor==3.7.1` on Python 3.13.5):

| Evaluation Dimension | Motor 3.7.1 | PyMongo Async (`pymongo.AsyncMongoClient`) |
| :--- | :--- | :--- |
| **Maintenance Status** | Maintained, but officially announced for future deprecation in favor of PyMongo Async. | The active, long-term official async driver developed directly by MongoDB. |
| **FastAPI / AnyIO Compatibility**| Fully compatible; runs directly on the standard asyncio loop. | Fully compatible; native coroutines without wrappers. |
| **API Differences** | `await collection.find_one(...)`<br>`await collection.find().to_list(100)` | `await collection.find_one(...)`<br>`await collection.find().to_list(100)` or `async for doc in ...` |
| **Connection Pooling** | Handled transparently via underlying PyMongo pool (`maxPoolSize=50`). | Native PyMongo connection pool. |
| **Existing Codebase State** | Already verified and working in `backend/app/db/mongo.py` with Atlas. | Available in `pymongo.asynchronous`, but requires rewriting `mongo.py`. |
| **Migration Risk** | **Zero Risk:** Current Atlas connectivity, ping, and indexes already run on Motor. | **Low-to-Medium Risk:** Minor refactoring of `mongo.py`. |

### Recommendation:
**Retain Motor 3.7.1 for the Phase 3 implementation.**
- Motor's query interface (`find_one`, `find().to_list()`, `replace_one`, `update_one`, `aggregate().to_list()`) is already tested against Atlas in our verification scripts.
- The repository design cleanly isolates database driver syntax from the rest of the application. If PyMongo Async is adopted in a future phase, only the repository internal calls would change, leaving routers and services 100% untouched.

---

## 6. Database Model Mapping Specifications

| Relational Table (SQLite) | MongoDB Atlas Collection | Document Model & Mapping Strategy |
| :--- | :--- | :--- |
| `users` | `users` | **1:1 Flat Document:** `_id` (String UUID/slug), `email`, `display_name`, `hashed_password`, `role`, `status`, `created_at`. Unique index on `email`. |
| `menu_versions`<br>`menu_meal_entries`<br>`dish_items` | `menu_versions` | **Embedded Hierarchy:** `_id` (`menu-v1`), `version_number`, `status`, `published_at`, `meals: [ { id, day_of_week, meal_type, accompaniments, notes, dishes: [ { id, name, alternatives, category } ] } ]`. Atomic reads; no multi-table joins. |
| `meal_instances`<br>`forecast_recommendations`<br>`vendor_decisions`<br>`meal_outcomes` | `meal_instances` | **Embedded Subdocuments:** `_id` (`mi-YYYY-MM-DD-type`), `meal_date`, `meal_type`, `menu_version_id`, `response_deadline`, `status`. Subdocuments: `recommendation`, `vendor_decision`, `outcome`. Unrecorded measurements remain `null`. |
| `meal_responses` | `meal_responses` | **Referenced Collection:** `_id`, `student_id`, `meal_instance_id`, `choice`, `submitted_at`, `updated_at`. Unique compound index on `(student_id, meal_instance_id)` guarantees single response per student under high concurrency. |
| `notification_schedules` | `notification_schedules` | **Flat Document:** 28 slot definitions. Unique compound index on `(day_of_week, meal_type)`. |
| `notifications` | `notifications` | **Flat Document:** `_id`, `user_id`, `meal_instance_id`, `title`, `message`, `is_read`, `created_at`. Indexed on `(user_id, is_read)`. |

### Critical Technical Conventions:
- **String Identifiers:** All MongoDB documents retain string identifiers (`_id: "student-1"`, `_id: "mi-2026-11-03-breakfast"`). This guarantees 100% compatibility with frontend string IDs and avoids BSON `ObjectId` serialization errors.
- **Datetime & Timezone Handling:** Persisted timestamps use UTC ISO 8601 strings or native UTC datetimes. Meal schedule comparisons strictly parse offsets relative to `Asia/Kolkata`.

---

## 7. Authentication Strategy

1. **Decoupled Auth Dependency:**
   Refactor `get_current_user` in [backend/app/dependencies/auth.py](file:///C:/Users/Suraj%20ranjan%20kumar/Desktop/messmate/backend/app/dependencies/auth.py) to depend on `user_repo: IUserRepository = Depends(get_user_repository)` instead of `db: Session = Depends(get_db)`.
2. **Dual-Backend Account Lookup:**
   - In MongoDB mode: `user = await user_repo.get_by_id(user_id)` queries `db.users.find_one({"_id": user_id, "status": "ACTIVE"})`.
   - In SQLite mode: `user = await user_repo.get_by_id(user_id)` queries `session.query(User).filter(...)`.
3. **Password Security:**
   Bcrypt hash verification remains direct and identical across both backends. The user object returned to route handlers is a Pydantic `UserOut` model that strictly omits `hashed_password`.

---

## 8. Business Invariant Preservation Matrix

| Invariant | SQLite Enforcement | MongoDB Atlas Enforcement |
| :--- | :--- | :--- |
| **1. One response per student per meal** | SQL `UniqueConstraint("student_id", "meal_instance_id")` | Unique compound index on `meal_responses`: `[("student_id", 1), ("meal_instance_id", 1)]`. Updates use atomic `replace_one(..., upsert=True)`. |
| **2. "No Response" != "Not Eating"** | SQL `COUNT()` aggregation with $\max(0, N_{\text{total}} - N_{\text{responded}})$ | MongoDB aggregation pipeline grouping by `choice`, calculating `no_response = max(0, total_registered - sum(responded))`. |
| **3. Server-side deadline cutoff** | UTC comparison in Python route before SQL commit | UTC comparison in Python service before Motor write. Responses after deadline return HTTP 400. |
| **4. Original recommendation preservation** | Preserved in `vendor_decisions.original_recommendation` column | Preserved in `meal_instances.vendor_decision.original_recommendation` field. |
| **5. Null outcome preservation** | Columns nullable; nulls stored as SQL `NULL` | Fields stored as `null` or omitted; never coerced to `0`. |
| **6. Published menu immutability** | Update blocked if status is `PUBLISHED` | Update blocked if status is `PUBLISHED`. New versions created via version increment. |

---

## 9. Implementation Roadmap & Milestones

```text
Milestone 1: Repository Interfaces & Factory
    │
    ▼
Milestone 2: User Repository & Auth Migration
    │
    ▼
Milestone 3: Menu Repository & Published Menu Retrieval
    │
    ▼
Milestone 4: Meal Instance Repository & Deadline Management
    │
    ▼
Milestone 5: Response Repository & High-Concurrency Submissions
    │
    ▼
Milestone 6: Forecast, Decision & Outcome Repositories
    │
    ▼
Milestone 7: Schedule & Notification Repositories
    │
    ▼
Milestone 8: Reports & Dashboard Aggregations
    │
    ▼
Milestone 9: FastAPI Router Integration & Async Conversion
    │
    ▼
Milestone 10: Dual-Backend Test Suite & Full-Stack E2E Validation
```

### Detailed Milestone Breakdown:

#### Milestone 1: Repository Interfaces & Dependency Provider
- **Goal:** Create base interfaces and dependency injection factory that resolves repositories based on `settings.DATABASE_BACKEND`.
- **Files Created:**
  - `backend/app/repositories/base.py`
  - `backend/app/repositories/user.py`
  - `backend/app/repositories/menu.py`
  - `backend/app/repositories/meal.py`
  - `backend/app/repositories/response.py`
  - `backend/app/repositories/forecast.py`
  - `backend/app/repositories/outcome.py`
  - `backend/app/repositories/schedule.py`
  - `backend/app/repositories/notification.py`
  - `backend/app/repositories/report.py`
  - `backend/app/dependencies/repositories.py`
- **Acceptance Criteria:** Repositories can be injected into FastAPI routes via `Depends()`.

#### Milestone 2: User Repository & Authentication Integration
- **Goal:** Migrate `auth.py` and `users.py` to use `IUserRepository`.
- **Files Modified:**
  - `backend/app/dependencies/auth.py`
  - `backend/app/api/routes/auth.py`
  - `backend/app/api/routes/users.py`
- **Acceptance Criteria:** Student, Vendor, and Admin login works against both MongoDB Atlas and SQLite.

#### Milestone 3: Menu Repository (Atomic Embedded Hierarchy)
- **Goal:** Implement `IMenuRepository` with SQLite and Mongo backends.
- **Files Modified:**
  - `backend/app/api/routes/menus.py`
- **Acceptance Criteria:** `GET /api/v1/menus/published` returns all 28 meal entries and 108 dishes from MongoDB Atlas in a single query.

#### Milestone 4: Meal Instance Repository & Deadline Engine
- **Goal:** Implement `IMealRepository` with dynamic status refreshing.
- **Files Modified:**
  - `backend/app/api/routes/meals.py`
- **Acceptance Criteria:** `GET /today` and `GET /actionable` correctly filter meals and evaluate server-side UTC deadlines.

#### Milestone 5: Response Repository & Aggregations
- **Goal:** Implement `IResponseRepository` with compound unique constraint and count aggregation.
- **Files Modified:**
  - `backend/app/api/routes/responses.py`
- **Acceptance Criteria:** Student submission, update before deadline, and vendor aggregate counts (`No Response != Not Eating`) pass against Atlas.

#### Milestone 6: Forecast, Decision & Outcome Repositories
- **Goal:** Implement `IForecastRepository` and `IOutcomeRepository`.
- **Files Modified:**
  - `backend/app/api/routes/forecasts.py`
  - `backend/app/api/routes/outcomes.py`
- **Acceptance Criteria:** Overrides preserve original $Q=756$; outcomes record actual attendance and leftovers with null safety.

#### Milestone 7: Schedule, Notification & Report Repositories
- **Goal:** Implement remaining repositories (`IScheduleRepository`, `INotificationRepository`, `IReportRepository`).
- **Files Modified:**
  - `backend/app/api/routes/schedules.py`
  - `backend/app/api/routes/notifications.py`
  - `backend/app/api/routes/reports.py`
- **Acceptance Criteria:** 28 notification schedules validate; dashboard summaries compute correct metrics.

#### Milestone 8: Full-Stack Verification & Live Atlas Integration Tests
- **Goal:** Create dedicated integration test script targeting live MongoDB Atlas.
- **Files Created:**
  - `backend/tests/test_mongo_integration.py`
- **Acceptance Criteria:** 100% of integration checkpoints pass against live MongoDB Atlas while preserving SQLite fallback.

---

## 10. File-by-File Change Plan

```text
Directory: backend/app/
├── repositories/                     [NEW PACKAGE]
│   ├── __init__.py
│   ├── base.py                       # Abstract base repository interfaces
│   ├── mongodb/                      # MongoDB Atlas implementations (Motor)
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── menu.py
│   │   ├── meal.py
│   │   ├── response.py
│   │   ├── forecast.py
│   │   ├── outcome.py
│   │   ├── schedule.py
│   │   ├── notification.py
│   │   └── report.py
│   └── sqlite/                       # SQLite implementations (SQLAlchemy)
│       ├── __init__.py
│       ├── user.py
│       ├── menu.py
│       ├── meal.py
│       ├── response.py
│       ├── forecast.py
│       ├── outcome.py
│       ├── schedule.py
│       ├── notification.py
│       └── report.py
├── dependencies/
│   ├── database.py                   # Injects active session/client
│   ├── repositories.py               # [NEW] Factory injecting repository based on DATABASE_BACKEND
│   └── auth.py                       # Updated to use IUserRepository
└── api/routes/
    ├── auth.py                       # Refactored to use user repository
    ├── users.py                      # Refactored to use user repository
    ├── menus.py                      # Refactored to use menu repository
    ├── meals.py                      # Refactored to use meal repository
    ├── responses.py                  # Refactored to use response repository
    ├── forecasts.py                  # Refactored to use forecast repository
    ├── outcomes.py                   # Refactored to use outcome repository
    ├── schedules.py                  # Refactored to use schedule repository
    ├── notifications.py              # Refactored to use notification repository
    └── reports.py                    # Refactored to use report repository
```

---

## 11. Risk Management & Mitigation

| Potential Risk | Severity | Mitigation Strategy |
| :--- | :--- | :--- |
| **Breaking existing SQLite test suite** | High | All SQLite repository methods will be verified against the existing 41 Pytest tests. In-memory SQLite testing will remain 100% functional. |
| **Atlas network latency during tests** | Medium | Connection pooling (`minPoolSize=5, maxPoolSize=50`) pre-warms sockets. Health checks verify connectivity before running integration checks. |
| **Silent fallback hiding outages** | High | If MongoDB Atlas is selected and fails, the application explicitly raises an exception. No silent fallback to SQLite is permitted. |
| **Data overwrite during tests** | High | Test suites use isolated mock test IDs or read-only queries against Atlas; existing 66 migrated production documents will never be deleted or overwritten. |

---

## 12. Final Recommendation

Proceed with **Milestone 1 & Milestone 2 (Repository Infrastructure and User/Auth Migration)** first. This will enable immediate verification of student, vendor, and administrator authentication against live MongoDB Atlas while preserving SQLite fallback.
