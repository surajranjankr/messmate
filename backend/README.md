# MessMate Backend (FastAPI + SQLite)

The FastAPI backend for **MessMate**, providing persistent database storage, server-side deadline enforcement, JWT role-based access control, baseline forecasting, and audit logging.

---

## Technology Stack

- **Python**: 3.13.5 (in `backend/.venv`)
- **Web Framework**: FastAPI 0.162.0 / Starlette
- **ASGI Server**: Uvicorn 0.54.0
- **ORM & DB**: SQLAlchemy 2.1.6 with SQLite (`backend/data/messmate.db`)
- **Data Validation**: Pydantic v2.14.2 (with CamelModel for camelCase frontend serialization)
- **Security**: Direct `bcrypt` password hashing, `PyJWT` signed Bearer tokens
- **Testing**: `pytest 9.2.0`, `pytest-asyncio`, `httpx` (33 automated tests passing)

---

## Directory Structure

```text
backend/
├── .venv/                    # Python virtual environment
├── app/
│   ├── api/
│   │   ├── routes/           # 10 route modules (/auth, /users, /menus, /meals,
│   │   │                     # /responses, /schedules, /forecasts, /outcomes,
│   │   │                     # /reports, /notifications)
│   │   └── router.py         # Root API v1 router aggregator
│   ├── core/
│   │   ├── config.py         # Pydantic BaseSettings (.env loading, defaults)
│   │   └── security.py       # Bcrypt hash/verify & PyJWT token generator
│   ├── db/
│   │   ├── session.py        # SQLAlchemy engine with PRAGMA foreign_keys=ON
│   │   └── initialization.py # Idempotent seeder with official IIIT Dharwad menu
│   ├── dependencies/
│   │   ├── auth.py           # get_current_user & require_role RBAC
│   │   └── database.py       # Session injection
│   ├── models/               # SQLAlchemy models (User, MenuVersion, MealInstance,
│   │                         # MealResponse, ForecastRecommendation, etc.)
│   ├── schemas/              # Pydantic v2 schemas inheriting from CamelModel
│   └── main.py               # FastAPI application with lifespan seeder & CORS
├── data/
│   └── messmate.db           # SQLite database file
├── tests/                    # 33 comprehensive unit and integration tests
├── requirements.txt          # Python dependency manifest
├── pyproject.toml            # Pytest configuration
└── verify_integration.py     # 14-checkpoint end-to-end integration test
```

---

## Quick Start

```powershell
# 1. Activate virtual environment
.\.venv\Scripts\Activate.ps1

# 2. Start backend server
uvicorn app.main:app --reload --port 8000
```

- API Base: `http://localhost:8000/api/v1`
- Swagger UI: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

---

## Running Backend Tests

```powershell
.\.venv\Scripts\pytest -v tests
```
*Result: 33 passed tests covering authentication, menus, meals, responses, schedules, forecasts, outcomes, and reports.*

---

## Running Full-Stack E2E Verification Check

```powershell
.\.venv\Scripts\python verify_integration.py
```
*Result: All 14 integration checkpoints verified.*
