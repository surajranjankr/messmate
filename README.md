# MessMate — Institutional Food Demand Forecasting & Meal Planning

MessMate is a frugal innovation web application designed for **IIIT Dharwad Mess 1** to estimate meal attendance demand, empower students to communicate advance meal intentions, and assist catering vendors in planning kitchen preparation to reduce avoidable food waste without risking shortages.

---

## 🌐 Live Application Demo

- **Live Application Link:** [https://messmate-ztj1.onrender.com/login](https://messmate-ztj1.onrender.com/login)
- **Backend API Base:** [https://messmate-api-idjb.onrender.com/api/v1](https://messmate-api-idjb.onrender.com/api/v1)
- **Interactive Swagger Docs:** [https://messmate-api-idjb.onrender.com/docs](https://messmate-api-idjb.onrender.com/docs)

---

## 📋 Interactive Demo Walkthrough (Step-by-Step)

Follow these guided steps to evaluate the end-to-end full-stack workflow:

### Step 1: Student Intention Submission
1. Log in at the login screen as **Student**:
   - **Email:** `arjun@iiitdwd.ac.in`
   - **Password:** `demo123`
2. On the Student Dashboard, review today's meals (November 4, 2026).
3. Click **Dinner** (Menu: *Mixed Veg Curry, Chapati & Dal Fry*).
4. Select your attendance intention: choose **"Probably Eating"** (or **"Definitely Eating"**).
5. Click **Submit Response**. Notice the real-time confirmation badge.

### Step 2: Vendor Live Tracking & Preparation Planning
1. Sign out and log in as **Mess Vendor**:
   - **Email:** `vendor@iiitdwd.ac.in`
   - **Password:** `demo123`
2. On the **Vendor Dashboard**, notice the live pulsing indicator:
   `🟢 Live Student Response Counts (Updating live)`
3. Observe the **Dinner** card immediately reflecting your student response under **"Probably Eating"**.
4. Click **"Review & Confirm Batch Quantity"** on the Dinner card.
5. In the **Kitchen Preparation Planning** sheet:
   - Notice the incoming meal is accurately set to **Dinner • Nov 4, 2026**.
   - Check the formula-based portion recommendation:
     $$Q = \lceil F \times (1 + m) \rceil$$
     *(Expected demand with safety margin buffer)*.
   - Adjust portions using the **`+` / `−`** stepper buttons, or click **"Use Recommended"**.
   - Click **Confirm Preparation Plan**.

### Step 3: Simulation Clock & Deadline Testing
1. In the bottom-right corner of the screen, click the **Simulation Clock** widget.
2. Click **Adjust** to test deadline behaviors:
   - Advance time by `+1 Hour`, `+4 Hours`, or reset to system time.
   - All open browser tabs synchronize simulation time instantly via local storage broadcast.
   - If time passes the 5:00 PM cutoff, the student response window locks automatically with strict server-side deadline enforcement.

### Step 4: Administrator Audit & Operations
1. Sign out and log in as **Administrator**:
   - **Email:** `admin@iiitdwd.ac.in`
   - **Password:** `MessMate#Admin2026!`
2. Navigate to **User Management** to view active students, vendors, and admins, or add new institutional users.
3. Check **Menu Management** to inspect the official 4-week rotating IIIT Dharwad menu.
4. Open **Reports & Analytics** to evaluate historical attendance trends and waste reduction analytics.

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

## 3. Demo Credentials & Development Access

> [!WARNING]
> **DEVELOPMENT & TESTING ONLY:**
> The following credentials are provided strictly for local demonstration, automated testing, and development evaluation. They must NEVER be used in production environments. Production deployments must integrate institute Single Sign-On (SSO) or enforce distinct, securely rotated administrative credentials.

All default student and vendor accounts use password: **`demo123`**  
The administrator account uses password: **`MessMate#Admin2026!`**

| Role | Name | Institute Email | Password | Access & Permissions |
|---|---|---|---|---|
| **Student** | Arjun Sharma | `arjun@iiitdwd.ac.in` | `demo123` | Views weekly menu, submits meal intentions before deadline, views private history |
| **Student** | Priya Patel | `priya@iiitdwd.ac.in` | `demo123` | Student workflows and intention submissions |
| **Student** | Rahul Verma | `rahul@iiitdwd.ac.in` | `demo123` | Student workflows and intention submissions |
| **Vendor** | Mess Vendor | `vendor@iiitdwd.ac.in` | `demo123` | Inspects dynamic aggregate counts, reviews baseline recommendations, confirms batch sizes, logs leftovers |
| **Administrator** | Admin User | `admin@iiitdwd.ac.in` | `MessMate#Admin2026!` | Full management: users, draft/published menus, 28 notification schedules, operational audit reports |

> **Security Note:** Quick Demo autofill cards have been removed from the user interface. Users must authenticate manually using their institute credentials.

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
