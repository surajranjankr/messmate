"""
MessMate Repository Dependency Provider
=======================================
Provides database repository instances based on active DATABASE_BACKEND setting
(SQLite or MongoDB Atlas). Enforces explicit selection with zero silent fallback.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.db.mongo import get_mongo_db
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.repositories import (
    IUserRepository,
    IMenuRepository,
    IMealRepository,
    IResponseRepository,
    IForecastRepository,
    IOutcomeRepository,
    IScheduleRepository,
    INotificationRepository,
    IReportRepository,
    ISettingsRepository,
    SqliteUserRepository,
    SqliteMenuRepository,
    SqliteMealRepository,
    SqliteResponseRepository,
    SqliteForecastRepository,
    SqliteOutcomeRepository,
    SqliteScheduleRepository,
    SqliteNotificationRepository,
    SqliteReportRepository,
    SqliteSettingsRepository,
    MongoUserRepository,
    MongoMenuRepository,
    MongoMealRepository,
    MongoResponseRepository,
    MongoForecastRepository,
    MongoOutcomeRepository,
    MongoScheduleRepository,
    MongoNotificationRepository,
    MongoReportRepository,
    MongoSettingsRepository,
)


def _get_mongo_db_or_503():
    """Helper to safely retrieve MongoDB database instance with strict 503 on failure."""
    if not settings.MONGODB_URI:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB persistence selected but MONGODB_URI is not configured.",
        )
    try:
        return get_mongo_db()
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"MongoDB Atlas connection failure: {str(err)}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database initialization error: {str(exc)}",
        )


def get_user_repository(
    sqlite_db: Session = Depends(get_db),
) -> IUserRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoUserRepository(_get_mongo_db_or_503())
    return SqliteUserRepository(sqlite_db)


def get_menu_repository(
    sqlite_db: Session = Depends(get_db),
) -> IMenuRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoMenuRepository(_get_mongo_db_or_503())
    return SqliteMenuRepository(sqlite_db)


def get_meal_repository(
    sqlite_db: Session = Depends(get_db),
) -> IMealRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoMealRepository(_get_mongo_db_or_503())
    return SqliteMealRepository(sqlite_db)


def get_response_repository(
    sqlite_db: Session = Depends(get_db),
) -> IResponseRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoResponseRepository(_get_mongo_db_or_503())
    return SqliteResponseRepository(sqlite_db)


def get_forecast_repository(
    sqlite_db: Session = Depends(get_db),
) -> IForecastRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoForecastRepository(_get_mongo_db_or_503())
    return SqliteForecastRepository(sqlite_db)


def get_outcome_repository(
    sqlite_db: Session = Depends(get_db),
) -> IOutcomeRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoOutcomeRepository(_get_mongo_db_or_503())
    return SqliteOutcomeRepository(sqlite_db)


def get_schedule_repository(
    sqlite_db: Session = Depends(get_db),
) -> IScheduleRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoScheduleRepository(_get_mongo_db_or_503())
    return SqliteScheduleRepository(sqlite_db)


def get_notification_repository(
    sqlite_db: Session = Depends(get_db),
) -> INotificationRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoNotificationRepository(_get_mongo_db_or_503())
    return SqliteNotificationRepository(sqlite_db)


def get_report_repository(
    sqlite_db: Session = Depends(get_db),
) -> IReportRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoReportRepository(_get_mongo_db_or_503())
    return SqliteReportRepository(sqlite_db)


def get_settings_repository(
    sqlite_db: Session = Depends(get_db),
) -> ISettingsRepository:
    if settings.DATABASE_BACKEND.lower() == "mongodb":
        return MongoSettingsRepository(_get_mongo_db_or_503())
    return SqliteSettingsRepository(sqlite_db)
