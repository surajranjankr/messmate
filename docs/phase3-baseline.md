# MessMate Phase 3 Baseline Audit & Architecture Report

---

## 1. Executive Summary

This document establishes the verified baseline of the **MessMate** application as of the start of Phase 3 (MongoDB Migration, External API Integration, and Deployment Readiness).

All observations, schemas, endpoint signatures, and metrics documented herein were derived from direct source code inspection and test execution against the repository at `C:\Users\Suraj ranjan kumar\Desktop\messmate` (Git commit `0e9f5f9f3126c0b458814d199f9b0d0719e4de0c` on branch `main`).

---

## 2. Existing System Architecture

MessMate operates as a decoupled full-stack web application:

1. **Frontend:** Single-page application built on React 19, TypeScript 5.9, Vite 5.4, and Tailwind CSS 3.4. Component primitives are implemented using Radix UI and styled with Tailwind utility classes.
2. **Domain Service Layer:** 9 client-side domain services (`authService`, `menuService`, `mealInstanceService`, `responseService`, `forecastService`, `outcomeService`, `scheduleService`, `reportService`, `notificationService`) interface with a centralized HTTP client (`apiClient.ts`) that targets `/api/v1` and falls back gracefully to `localStorage` when offline or disconnected.
3. **Backend API:** FastAPI 0.162.0 web application running via Uvicorn ASGI server with modular routers prefixed under `/api/v1`.
4. **Current Persistence Layer:** Relational SQLAlchemy 2.0 ORM connected to SQLite (`backend/data/messmate.db`) with Foreign Key pragmas explicitly enabled (`PRAGMA foreign_keys=ON`).
5. **Authentication & Authorization:** RFC 7519 JSON Web Token (JWT) bearer authentication signed with HMAC-SHA256 (`HS256`), password hashing via `bcrypt` (work factor 12), and role-based route guards (`STUDENT`, `VENDOR`, `ADMIN`).

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
│   Dependencies: PyJWT Bearer Auth, Role Guards, UTC Clock       │
│                                │                                │
│                                ▼                                │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │           SQLAlchemy 2.0 ORM + SQLite Engine            │   │
│   │   File: backend/data/messmate.db                        │   │
│   │   11 Relational Tables with Foreign Keys & Constraints  │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Existing Database Schema & Entity Relationships

The current relational SQLite database defines 11 tables:

### Table Summary & Record Counts (from `backend/data/messmate.db`)

| Table Name | Primary Key | Foreign Keys | Key Constraints / Indexes | Baseline Row Count |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `id` (VARCHAR 64) | None | `email` UNIQUE, INDEX | 5 (3 students, 1 vendor, 1 admin) |
| `menu_versions` | `id` (VARCHAR 64) | None | `version_number` INDEX | 1 (menu-v1, status: `PUBLISHED`) |
| `menu_meal_entries` | `id` (VARCHAR 64) | `menu_version_id` -> `menu_versions.id` | INDEX on `menu_version_id` | 28 (7 days x 4 meals) |
| `dish_items` | `id` (VARCHAR 64) | `menu_meal_entry_id` -> `menu_meal_entries.id` | INDEX on `menu_meal_entry_id` | 108 (Official IIIT Dharwad menu) |
| `meal_instances` | `id` (VARCHAR 64) | `menu_version_id` -> `menu_versions.id` | INDEX on `meal_date`, INDEX on `menu_version_id` | 28 (yesterday, today, upcoming 5 days) |
| `meal_responses` | `id` (VARCHAR 64) | `student_id` -> `users.id`, `meal_instance_id` -> `meal_instances.id` | UNIQUE `(student_id, meal_instance_id)` | 2 |
| `notification_schedules`| `id` (VARCHAR 64) | None | INDEX on `id` | 28 (4 slots x 7 days) |
| `notifications` | `id` (VARCHAR 64) | `user_id` -> `users.id`, `meal_instance_id` -> `meal_instances.id` | INDEX on `user_id` | 2 |
| `forecast_recommendations`| `meal_instance_id` | `meal_instance_id` -> `meal_instances.id` | 1-to-1 with `meal_instances` | 2 |
| `vendor_decisions` | `meal_instance_id` | `meal_instance_id` -> `meal_instances.id` | 1-to-1 with `meal_instances` | 2 |
| `meal_outcomes` | `meal_instance_id` | `meal_instance_id` -> `meal_instances.id` | 1-to-1 with `meal_instances` | 2 |

---

## 4. Current API Endpoint Contracts

All endpoints are hosted under `/api/v1` and protected by HTTP Bearer authentication where applicable:

| Route Prefix | Method & Path | Authorization | Purpose |
| :--- | :--- | :--- | :--- |
| `/auth` | `POST /login` | Public | Returns `{ access_token, token_type: "bearer", user }` |
| `/auth` | `GET /me` | Any Authenticated | Returns current authenticated `UserResponse` |
| `/users` | `GET /` | `ADMIN` only | Lists all users |
| `/users` | `POST /` | `ADMIN` only | Creates a new user |
| `/users` | `GET /{id}` | Authenticated | Gets user by ID (Self or Admin) |
| `/menus` | `GET /` | Authenticated | Lists all menu versions |
| `/menus` | `GET /published` | Authenticated | Returns active published menu with 28 meal entries & dishes |
| `/menus` | `POST /` | `ADMIN` only | Creates new draft or published menu version |
| `/menus` | `POST /{id}/publish` | `ADMIN` only | Sets status to `PUBLISHED`, archives previously published version |
| `/meals` | `GET /today` | Authenticated | Returns all 4 meal instances for current local date |
| `/meals` | `GET /actionable` | Authenticated | Returns upcoming meals currently open for response |
| `/meals` | `GET /{id}` | Authenticated | Gets specific meal instance details |
| `/responses` | `GET /mine` | `STUDENT` | Returns authenticated student's historical responses |
| `/responses` | `POST /` | `STUDENT` | Creates or updates meal choice before deadline |
| `/responses` | `GET /meal/{id}/counts` | `VENDOR`, `ADMIN` | Returns aggregate counts (`definitely`, `probably`, `notEating`, `noResponse`) |
| `/schedules` | `GET /` | Authenticated | Returns 28 configured notification schedules |
| `/schedules` | `PUT /batch` | `ADMIN` only | Validates and updates notification schedules |
| `/schedules` | `POST /validate`| `ADMIN` only | Checks schedule timing overlaps and boundary rules |
| `/forecasts` | `GET /{meal_id}` | `VENDOR`, `ADMIN` | Generates baseline recommendation ($B=700, m=0.08, Q=756$) |
| `/forecasts` | `POST /{meal_id}/decision` | `VENDOR` only | Saves vendor preparation decision (preserves original $Q$) |
| `/outcomes` | `GET /{meal_id}` | `VENDOR`, `ADMIN` | Fetches recorded post-meal actuals |
| `/outcomes` | `POST /{meal_id}`| `VENDOR` only | Records actual attendance, prepared portions, leftover kg |
| `/reports` | `GET /vendor/summary`| `VENDOR`, `ADMIN` | Generates aggregate consumption and variance statistics |
| `/reports` | `GET /admin/summary` | `ADMIN` only | System-wide statistics for administrative audit |
| `/notifications`| `GET /` | Authenticated | Returns unread notifications for current user |
| `/notifications`| `PUT /{id}/read` | Authenticated | Marks notification as read |

---

## 5. Existing Authentication & Authorization Mechanism

- **Token Type:** RFC 7519 JWT signed with HMAC-SHA256 (`HS256`).
- **Token Claims:** `sub` (User ID), `role` (`STUDENT` | `VENDOR` | `ADMIN`), `exp` (expiration timestamp, default 24 hours).
- **Password Storage:** Salted SHA-256 / Bcrypt hash generated via `bcrypt` library (work factor 12).
- **Role Verification:** FastAPI dependency `require_roles(["ADMIN"])` decodes token header, looks up the active user, and validates role membership.
- **Production Safeguard:** Demo user seeding and standard demo passwords (`demo123`) are explicitly disabled if `ENVIRONMENT == "production"`.

---

## 6. Baseline Test Results

All test suites executed successfully without errors:

1. **Backend Unit & Integration Suite (`pytest`):**
   - **Result:** 33 passed, 1 warning (Starlette test client deprecation notice).
   - **Coverage:** Auth, Menus, Meals, Responses, Forecasts, Outcomes, Schedules, Reports.
2. **Frontend Unit & Component Suite (`vitest`):**
   - **Result:** 8 test files passed, 31 tests passed.
   - **Coverage:** `apiClient`, `storage`, `authService`, `menuService`, `responseService`, `forecastService`, `scheduleService`, UI components.
3. **End-to-End Integration Verification (`verify_integration.py`):**
   - **Result:** 14/14 checkpoints passed.
   - **Direct SQLite verification:** Direct row verification in `messmate.db` verified write consistency for responses, vendor decisions, and outcomes.

---

## 7. Existing External Integrations

**Zero external cloud services or 3rd-party APIs are currently integrated:**
- **Email:** None. No SMTP, SendGrid, Resend, or SES client is configured.
- **WhatsApp:** None. No Meta Cloud API or BSP client is configured. Notifications are purely in-app records stored in the local SQLite table `notifications`.
- **Database:** Local SQLite database file (`backend/data/messmate.db`). No cloud database driver (e.g. `motor`, `pymongo`) is currently installed.
- **External Auth:** None. Local database username/password authentication only.

---

## 8. Migration Risks & Challenges (SQLite to MongoDB)

1. **Loss of Relational Foreign Key Integrity:** SQLite enforces relational constraints (`ON DELETE CASCADE`, foreign keys). MongoDB does not enforce relational referential integrity natively; integrity must be guaranteed via application-level validation or compound indexing.
2. **Document Modeling Choice (Embedding vs Referencing):**
   - Dishes and meal entries are strictly scoped to a menu version and rarely updated independently; embedding them inside `menu_versions` simplifies queries and atomic updates.
   - Student responses, meal outcomes, and forecasts are created asynchronously; embedding them all in `meal_instances` could create large, frequently mutated documents with concurrency contention. A hybrid referencing model is safer.
3. **Single Response Constraint (`UniqueConstraint("student_id", "meal_instance_id")`):** In MongoDB, this must be enforced using a unique compound index (`{"student_id": 1, "meal_instance_id": 1}`) with `unique=True`.
4. **Data Type Mismatches:** SQLite stores timestamps as ISO strings or datetime objects; MongoDB BSON stores native `datetime.datetime` in UTC. Migration scripts must normalize timezone handling.
5. **Dual Database Support / Transition Safety:** Abruptly rewriting SQLAlchemy routes to MongoDB without an abstraction layer would break existing tests and risk runtime regression. A clean repository abstraction or dual-engine support ensures SQLite remains functional as fallback.

---

## 9. Current Deployment Limitations

1. **Single-Instance SQLite Database:** SQLite cannot scale horizontally across serverless or multi-instance containers (e.g. Render, Railway, AWS ECS). Simultaneous writes from multiple instances can lead to database locks (`database is locked`).
2. **CORS Hardcoded for Localhost:** `backend/app/core/config.py` allows only `http://localhost:5173` and `http://127.0.0.1:5173`. Production deployments will block requests from deployed frontend domains (e.g., Vercel, Netlify).
3. **Static Secret Key:** `SECRET_KEY` in `config.py` defaults to an insecure development string if `.env` is omitted.
4. **No Automated Migration Tooling for NoSQL:** Alembic manages relational schemas; MongoDB Atlas requires index initialization scripts and collection validation schemas.
5. **Containerization & Health Checks:** The repository lacks a `Dockerfile`, `docker-compose.yml`, or deployment configuration files for production orchestration.
