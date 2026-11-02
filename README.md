# MessMate — Institutional Food Demand Forecasting & Meal Planning

MessMate is a frugal innovation web application designed for **IIIT Dharwad Mess 1** to estimate meal attendance demand, empower students to communicate advance meal intentions, and assist catering vendors in planning kitchen preparation to reduce avoidable food waste without risking shortages.

---

## 1. Project Status: Phase 2 Complete (Full-Stack Application)

MessMate development progress:

- **Phase 1 (Complete):** Complete React + TypeScript frontend with service layer, typed mock data, official IIIT Dharwad Mess 1 menu integration, and local browser persistence.
- **Phase 2 (Complete):** Production-grade FastAPI backend, SQLite database persistence (`backend/data/messmate.db`), SQLAlchemy 2.0 ORM models, native bcrypt password hashing, signed PyJWT authentication with RBAC, centralized REST API client integration (`frontend/src/services/apiClient.ts`), 33 backend pytest tests, 31 frontend vitest tests, and full-stack end-to-end verification.
- **Phase 3 (Integrated in Phase 2):** Frontend-to-backend REST API integration across all 9 domain services.
- **Phase 4 (Future):** Real in-app push notifications and WhatsApp Cloud API webhook messaging (currently labeled *"Not Connected — Prototype"*).
- **Phase 5 (Future):** Live operational pilot with dual-weighed baseline measurements to evaluate waste reduction.

---

## 2. Technology Stack

### Frontend
- **Framework:** React 19, TypeScript (strict mode)
- **Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4, custom CSS design tokens (**Theme A: Modern & Minimal — Purple/Lavender**)
- **Component Primitives:** Radix UI (`dialog`, `tabs`, `switch`, `slot`, `label`)
- **Icons:** Lucide React
- **Routing:** React Router v7 (with role-based route guards)
- **Data Visualization:** Recharts
- **API Client:** Native fetch client with automatic JWT Bearer header injection and 401 handling
- **Testing:** Vitest 5.1.0 (31 tests passing across 8 suites)
- **Linting:** oxlint

### Backend
- **Framework:** FastAPI 0.162.0 (Python 3.13.5 in `backend/.venv`)
- **ASGI Server:** Uvicorn 0.54.0
- **Database & ORM:** SQLAlchemy 2.1.6 with SQLite (`backend/data/messmate.db`, `PRAGMA foreign_keys=ON`)
- **Data Validation:** Pydantic v2.14.2 (with CamelModel for camelCase serialization)
- **Authentication:** Native `bcrypt` hashing, `PyJWT` signed Bearer tokens (24h validity)
- **Testing:** Pytest 9.2.0 (33 tests passing)
- **Seeding:** Idempotent database initialization with official IIIT Dharwad Mess 1 Menu dataset and 28 notification schedules

---

## 3. Demo Credentials

All demo accounts use password: **`demo123`**

| Role | Name | Institute Email | Access & Permissions |
|---|---|---|---|
| **Student** | Arjun Sharma | `arjun@iiitdwd.ac.in` | Views weekly menu, submits meal intentions before deadline, views private history |
| **Student** | Priya Patel | `priya@iiitdwd.ac.in` | Student workflows |
| **Student** | Rahul Verma | `rahul@iiitdwd.ac.in` | Student workflows |
| **Vendor** | Mess Vendor | `vendor@iiitdwd.ac.in` | Inspects aggregate counts, sees $Q=756$ recommendation, confirms batch size, logs leftovers |
| **Administrator** | Admin User | `admin@iiitdwd.ac.in` | Full management: users, draft/published menus, 28 notification schedules, audit reports |

> **Note:** The login screen provides **1-Click Demo Login** buttons to fill these credentials automatically.

---

## 4. Quick Start (Dual-Terminal)

### Terminal 1: Backend Server (FastAPI)
```powershell
cd "c:\Users\Suraj ranjan kumar\Desktop\messmate\backend"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```
- API Base: `http://localhost:8000/api/v1`
- Interactive Swagger Docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

### Terminal 2: Frontend App (React + Vite)
```powershell
cd "c:\Users\Suraj ranjan kumar\Desktop\messmate\frontend"
npm run dev
```
- Frontend Application: `http://localhost:5173`

---

## 5. Automated Testing & Verification

```powershell
# Run backend pytest suite (33 tests)
cd "c:\Users\Suraj ranjan kumar\Desktop\messmate\backend"
.\.venv\Scripts\pytest -v tests

# Run frontend Vitest suite (31 tests)
cd "c:\Users\Suraj ranjan kumar\Desktop\messmate\frontend"
npm test

# Run full-stack 14-checkpoint end-to-end verification
cd "c:\Users\Suraj ranjan kumar\Desktop\messmate"
.\backend\.venv\Scripts\python backend\verify_integration.py
```

---

## 6. Critical Business Invariants Verified

1. **Strict Server-Side Deadline Locking:** Evaluated against server UTC time. Once the meal cutoff has passed, intention responses cannot be submitted or changed.
2. **Vendor Aggregate Counts Separation:** `No Response` is strictly separated from `Not Eating`. For a cohort of 750 students with 0 responses, `noResponse = 750` and `notEating = 0`.
3. **Recommendation Audit Preservation:** When a vendor enters an override planned preparation quantity (e.g., 740 portions), the original formula recommendation ($Q = 756$) is strictly preserved in the database.
4. **Student Privacy:** Students can only view their own meal intention history. Aggregates are presented to vendors without individual identification.
5. **WhatsApp Labeling:** WhatsApp remains labeled as **Not Connected — Prototype** as mandated for this phase.
