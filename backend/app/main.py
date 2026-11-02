from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.db.session import SessionLocal
from app.db.initialization import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables and seed data are initialized idempotently
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()
    yield
    # Shutdown logic (if any)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for MessMate: Institutional food demand forecasting & meal planning for IIIT Dharwad.",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint for container / process monitoring."""
    return {
        "status": "healthy",
        "service": "MessMate Backend API",
        "version": "0.2.0",
        "environment": settings.ENVIRONMENT,
    }

@app.get("/", tags=["Root"])
def root():
    """Root info endpoint."""
    return {
        "message": "Welcome to MessMate API",
        "documentation": "/docs",
        "openapi": "/openapi.json",
        "institution": settings.INSTITUTION_NAME,
    }
