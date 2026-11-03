# MessMate Setup & Developer Guide (Full-Stack Phase 2)

A comprehensive guide to running, developing, and testing MessMate on Windows.

---

## Prerequisites

- **Python**: 3.12 or 3.13 (tested with Python 3.13.5)
- **Node.js**: v18+ (tested with v24.14.0)
- **npm**: v9+ (tested with v11.9.0)
- **Git**

---

## 1. Project Directory Structure

```text
messmate/
├── backend/                  # FastAPI Python backend
│   ├── .venv/                # Isolated virtual environment
│   ├── app/                  # Application source code
│   │   ├── api/routes/       # REST API endpoints
│   │   ├── core/             # Configuration, security, JWT
│   │   ├── db/               # Database session & idempotent seeder
│   │   ├── dependencies/     # Auth RBAC & database session injection
│   │   ├── models/           # SQLAlchemy ORM models
│   │   └── schemas/          # Pydantic v2 schemas (CamelModel)
│   ├── data/                 # SQLite storage (messmate.db)
│   ├── tests/                # Pytest test suite (33 tests)
│   ├── requirements.txt      # Python dependencies
│   ├── pyproject.toml        # Pytest & project configuration
│   └── verify_integration.py # 14-checkpoint E2E integration test
├── frontend/                 # React 19 TypeScript frontend
│   ├── src/                  # Components, pages, hooks, services
│   │   ├── services/         # 9 domain services + apiClient
│   │   └── test/             # Vitest test suite (31 tests)
│   ├── package.json
│   └── vite.config.ts
├── docs/                     # Documentation & specifications
└── README.md
```

---

## 2. Quick Start: Dual-Terminal Startup

### Terminal 1: Start Backend (FastAPI)

```powershell
# Navigate to the backend directory
cd "C:\Users\Suraj ranjan kumar\Desktop\messmate\backend"

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Start the Uvicorn ASGI development server
uvicorn app.main:app --reload --port 8000
```

Backend will be available at:
- API Base: `http://localhost:8000/api/v1`
- Swagger Interactive Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### Terminal 2: Start Frontend (React + Vite)

```powershell
# Navigate to the frontend directory
cd "C:\Users\Suraj ranjan kumar\Desktop\messmate\frontend"

# Launch the Vite development server
npm run dev
```

Frontend will be available at:
- Web Application: `http://localhost:5173`

---

## 3. Running Automated Tests

### Backend Test Suite (Pytest)

```powershell
cd "C:\Users\Suraj ranjan kumar\Desktop\messmate\backend"
.\.venv\Scripts\pytest -v tests
```
*Expected: 33 passed tests covering Auth, Menus, Meals, Responses, Schedules, Forecasts, Outcomes, and Reports.*

### Frontend Test Suite (Vitest)

```powershell
cd "C:\Users\Suraj ranjan kumar\Desktop\messmate\frontend"
npm test
```
*Expected: 31 passed tests across 8 test suites.*

### Full-Stack End-to-End Verification Check

```powershell
cd "C:\Users\Suraj ranjan kumar\Desktop\messmate"
.\backend\.venv\Scripts\python backend\verify_integration.py
```
*Expected: All 14 checkpoints passed successfully.*

---

## 4. Demo Login Accounts

All accounts use password: `demo123`

| Role | Email | Display Name | Permissions |
|---|---|---|---|
| **Student** | `arjun@iiitdwd.ac.in` | Arjun Sharma | View weekly menu, submit/change response before cutoff, view private response history |
| **Student** | `priya@iiitdwd.ac.in` | Priya Patel | Student workflows |
| **Student** | `rahul@iiitdwd.ac.in` | Rahul Verma | Student workflows |
| **Vendor** | `vendor@iiitdwd.ac.in` | Mess Vendor | View aggregate counts, see $Q=756$ recommendation, enter planned portions (e.g. 740), record headcount and leftovers |
| **Admin** | `admin@iiitdwd.ac.in` | Admin User | Full administrative access, menu drafts & publishing, schedule management & overlap acknowledgment, user management |

---

## 5. Environment Variables

### Backend (`backend/.env`)

```env
ENVIRONMENT=development
DEBUG=True
API_V1_PREFIX=/api/v1
DATABASE_URL=sqlite:///./data/messmate.db
SECRET_KEY=messmate-development-insecure-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

### Frontend (`frontend/.env.development`)

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 6. Phase 3: MongoDB Atlas Migration & Rollback

### Running the Migration Dry-Run

```powershell
cd "C:\Users\Suraj ranjan kumar\Desktop\messmate"
.\backend\.venv\Scripts\python backend\migrate_to_mongo.py --dry-run
```
*Creates an automated backup at `backend/data/backups/messmate_pre_mongo_<timestamp>.db`, validates document schemas, and reports expected document counts without writing to MongoDB.*

### Executing Migration to MongoDB Atlas

1. Configure `MONGODB_URI` in `backend/.env`.
2. Execute migration:
```powershell
.\backend\.venv\Scripts\python backend\migrate_to_mongo.py --execute
```

### Switching Active Database Engine

In `backend/.env`:
- To use MongoDB: `DATABASE_BACKEND=mongodb`
- To rollback to SQLite: `DATABASE_BACKEND=sqlite`

Both options are fully preserved and independently testable.

