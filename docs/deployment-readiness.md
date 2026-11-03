# MessMate Deployment Readiness & Cloud Architecture Plan

---

## 1. Cloud Target Architecture

```text
                  Students / Vendors / Administrators
                                   │
                                   ▼
                        React 19 Frontend (SPA)
                        Hosted on: Vercel Hobby
                                   │
                                   ▼ HTTPS REST (/api/v1)
                                   │
                        FastAPI Backend (ASGI)
                        Hosted on: Render Web Service
                                   │
             ┌─────────────────────┼─────────────────────┐
             ▼                     ▼                     ▼
     MongoDB Atlas (M0)      Resend Email API       In-App Alerts
    Cloud Database Cluster   Transactional Alerts   Web Notifications
```

---

## 2. Required Provider Accounts & Free Tier Specifications

| Service | Provider | Purpose | Free Tier Allowance | Card Required? |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Hosting** | **Vercel** | React SPA deployment, Global Edge CDN, automated Git deploys | Unlimited deployments, 100GB bandwidth/month | No |
| **Backend API Hosting**| **Render** | Docker / Python web service running Uvicorn ASGI | 750 free instance hours/month (Spins down on inactivity) | No |
| **Cloud Database** | **MongoDB Atlas** | Managed MongoDB cluster for persistent data | M0 Cluster: 512 MB storage, shared RAM, replica set | No |
| **Transactional Email**| **Resend** | Welcome emails, meal reminder notifications | 3,000 emails/month (100 emails/day), full REST API | No |
| **WhatsApp Messaging** | **Deferred** | Immediate in-app notifications used; WhatsApp ready for future | N/A | N/A |

**Total Estimated Hosting Cost for Phase 3:** **$0.00 / month** (all services operate on free developer tiers).

---

## 3. Environment Variables Reference

### A. Frontend Environment Configuration (`frontend/.env.production`)

| Variable Name | Required | Example Production Value | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** | `https://messmate-api.onrender.com/api/v1` | Points frontend fetch calls to deployed FastAPI backend |
| `VITE_APP_NAME` | No | `MessMate` | Branding title |
| `VITE_INSTITUTION` | No | `IIIT Dharwad` | Campus institutional designation |
| `VITE_STORAGE_PREFIX`| No | `MESSMATE_STORAGE_V1` | Local browser cache namespace |

> [!WARNING]
> Never place backend secrets, JWT keys, or database credentials in frontend environment files. Only variables prefixed with `VITE_` are bundled into client assets.

### B. Backend Environment Configuration (`backend/.env`)

| Variable Name | Required | Example Production Value | Security / Operational Requirement |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | **Yes** | `production` | **Enforces strict mode:** Disables demo user seeding and insecure keys |
| `DEBUG` | **Yes** | `False` | Disables verbose debug logging and traceback exposure |
| `DATABASE_BACKEND` | **Yes** | `mongodb` | Sets active persistence engine (`mongodb` or `sqlite`) |
| `MONGODB_URI` | **Yes** | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority` | Connection string obtained from MongoDB Atlas |
| `MONGODB_DATABASE` | **Yes** | `messmate` | Target production database name |
| `SECRET_KEY` | **Yes** | `[Generate 64-char random hex]` | Must be unique and unpredictable; app refuses to start if default key is used |
| `ALGORITHM` | No | `HS256` | JWT HMAC signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` (24 hours) | Token lifespan |
| `CORS_ORIGINS` | **Yes** | `["https://messmate-frontend.vercel.app"]` | Whitelist ONLY the production Vercel frontend URL |
| `EMAIL_PROVIDER` | No | `resend` | Active email provider adapter |
| `RESEND_API_KEY` | Optional | `re_123456789...` | API key from resend.com for email notifications |
| `EMAIL_FROM` | Optional | `notifications@messmate.iiitdwd.ac.in` | Verified sending domain or `onboarding@resend.dev` |

---

## 4. Step-by-Step Deployment Guide

### Phase A: MongoDB Atlas Setup
1. Log in to [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a free **M0 Sandbox** cluster in the nearest region (e.g., `AWS / ap-south-1 Mumbai`).
3. Under **Database Access**, create a user `messmate_app` with `readWrite` permissions on the `messmate` database.
4. Under **Network Access**, add an IP access entry:
   - For Render cloud connectivity, add `0.0.0.0/0` (Allow access from anywhere).
5. Click **Connect** -> **Drivers** -> **Python** to copy your connection string:
   `mongodb+srv://messmate_app:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
6. Add this string to your local `backend/.env` file.

### Phase B: Backend Deployment on Render
1. Create a new **Web Service** on [render.com](https://render.com) linked to your GitHub repo.
2. Root Directory: `backend`
3. Environment: `Python 3`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. In **Environment Variables**, configure:
   - `ENVIRONMENT` = `production`
   - `DATABASE_BACKEND` = `mongodb`
   - `MONGODB_URI` = `mongodb+srv://...`
   - `SECRET_KEY` = `[Randomly generated secure string]`
   - `CORS_ORIGINS` = `["https://<your-vercel-domain>.vercel.app"]`
7. Deploy service and copy the provided public HTTPS URL (e.g. `https://messmate-api.onrender.com`).

### Phase C: Frontend Deployment on Vercel
1. Log in to [vercel.com](https://vercel.com) and import the repository.
2. Root Directory: `frontend`
3. Framework Preset: `Vite`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. In **Environment Variables**, configure:
   - `VITE_API_BASE_URL` = `https://messmate-api.onrender.com/api/v1`
7. Deploy. Verify that API requests flow over HTTPS to the backend.

---

## 5. Security & Verification Checklist

- [x] **Secure Startup Enforcement:** FastAPI refuses to boot in `production` mode if `SECRET_KEY` contains development defaults.
- [x] **Demo Seeding Prevention:** `backend/app/db/initialization.py` completely disables automatic creation of demo accounts (`student1@iiitdwd.ac.in`, etc.) when `ENVIRONMENT == "production"`.
- [x] **CORS Whitelist Protection:** Configured to explicitly restrict browser API calls to whitelisted frontend origins.
- [x] **Graceful Fallback:** SQLite database file and automated backups remain preserved in `backend/data/backups/`.
- [x] **Database Isolation:** Migration tool `migrate_to_mongo.py` requires explicit `--execute` flag; dry-run mode writes 0 documents.
- [x] **Zero Secret Leakage:** `.env`, `.db`, and `.venv` are strictly ignored by `.gitignore` and absent from Git history.

---

## 6. Current Blockers to Live Deployment

1. **MongoDB Atlas Connection String:** Pending user configuration in local `backend/.env`.
2. **Explicit User Approval:** Required prior to running `python backend/migrate_to_mongo.py --execute`.
3. **Resend Sender Verification:** Resend API key configuration is prepared, awaiting user registration when ready.
