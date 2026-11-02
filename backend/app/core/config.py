from typing import List, Union
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

    # Database
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'data' / 'messmate.db'}"

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
    DEFAULT_BASELINE_ATTENDANCE: int = 700
    DEFAULT_SAFETY_MARGIN: float = 0.08
    TOTAL_REGISTERED_STUDENTS: int = 750

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
