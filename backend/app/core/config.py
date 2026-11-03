from typing import List, Union, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "MessMate API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database Backend Selection: 'sqlite' | 'mongodb'
    DATABASE_BACKEND: str = "sqlite"

    # SQLite
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'data' / 'messmate.db'}"

    # MongoDB Atlas
    MONGODB_URI: str = ""
    MONGODB_DATABASE: str = "messmate"

    # External APIs: Email (Resend)
    EMAIL_PROVIDER: str = "resend"
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "onboarding@resend.dev"

    # External APIs: WhatsApp (Deferred)
    WHATSAPP_PROVIDER: str = "mock"

    # JWT Security
    SECRET_KEY: str = "messmate-development-insecure-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Domain defaults
    INSTITUTION_NAME: str = "IIIT Dharwad"
    TIMEZONE: str = "Asia/Kolkata"
    DEFAULT_SAFETY_MARGIN: float = 0.08
    DEFAULT_NONRESPONSE_ATTENDANCE_RATE: Optional[float] = 0.70
    # Legacy fallbacks (deprecated; operational counts and forecasts are derived dynamically)
    DEFAULT_BASELINE_ATTENDANCE: int = 0
    TOTAL_REGISTERED_STUDENTS: int = 0

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_production_secret(cls, v: str, info) -> str:
        # Prevent starting in production mode with default insecure key
        env = os.environ.get("ENVIRONMENT", "development").lower()
        if env == "production" and ("insecure" in v or "change-in-production" in v or len(v) < 32):
            raise ValueError("Insecure default SECRET_KEY is strictly forbidden in production mode. Set a cryptographically secure key.")
        return v

    model_config = SettingsConfigDict(
        env_file=(
            str(BASE_DIR / "atlas-credentials.env"),
            str(BASE_DIR / ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
