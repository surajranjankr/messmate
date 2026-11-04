from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.db.session import SessionLocal
from app.db.initialization import init_db
from app.db.mongo import close_mongo_client, check_mongo_health, get_mongo_db, init_mongo_indexes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize selected database backend
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        if settings.MONGODB_URI:
            try:
                db = get_mongo_db()
                await init_mongo_indexes(db)
            except Exception as e:
                # Log clearly without breaking app startup if in development
                print(f"[Startup Warning] Could not initialize MongoDB: {e}")

    # Always ensure SQLite tables and fallback users are initialized
    db = SessionLocal()
    try:
        init_db(db)
    except Exception as e:
        print(f"[Startup Warning] SQLite fallback initialization: {e}")
    finally:
        db.close()

    yield

    # Shutdown logic
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        await close_mongo_client()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for MessMate: Institutional food demand forecasting & meal planning for IIIT Dharwad.",
    version="0.3.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for container / process monitoring and orchestrator readiness probes."""
    db_health = {"backend": settings.DATABASE_BACKEND}
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        mongo_status = await check_mongo_health()
        db_health.update(mongo_status)
    else:
        db_health.update({"status": "CONNECTED", "database": "sqlite"})

    return {
        "status": "healthy",
        "service": "MessMate Backend API",
        "version": "0.3.0",
        "environment": settings.ENVIRONMENT,
        "database": db_health,
    }

@app.get("/", tags=["Root"])
def root():
    """Root info endpoint."""
    return {
        "message": "Welcome to MessMate API",
        "documentation": "/docs",
        "openapi": "/openapi.json",
        "institution": settings.INSTITUTION_NAME,
        "database_backend": settings.DATABASE_BACKEND,
    }
