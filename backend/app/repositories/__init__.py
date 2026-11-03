"""
MessMate Repositories
=====================
Export domain interfaces and concrete implementations for SQLite and MongoDB Atlas.
"""

from app.repositories.base import IBaseRepository
from app.repositories.user import IUserRepository
from app.repositories.menu import IMenuRepository
from app.repositories.meal import IMealRepository
from app.repositories.response import IResponseRepository
from app.repositories.forecast import IForecastRepository
from app.repositories.outcome import IOutcomeRepository
from app.repositories.schedule import IScheduleRepository
from app.repositories.notification import INotificationRepository
from app.repositories.report import IReportRepository
from app.repositories.setting import ISettingsRepository

from app.repositories.sqlite.user import SqliteUserRepository
from app.repositories.sqlite.menu import SqliteMenuRepository
from app.repositories.sqlite.meal import SqliteMealRepository
from app.repositories.sqlite.response import SqliteResponseRepository
from app.repositories.sqlite.forecast import SqliteForecastRepository
from app.repositories.sqlite.outcome import SqliteOutcomeRepository
from app.repositories.sqlite.schedule import SqliteScheduleRepository
from app.repositories.sqlite.notification import SqliteNotificationRepository
from app.repositories.sqlite.report import SqliteReportRepository
from app.repositories.sqlite.setting import SqliteSettingsRepository

from app.repositories.mongodb.user import MongoUserRepository
from app.repositories.mongodb.menu import MongoMenuRepository
from app.repositories.mongodb.meal import MongoMealRepository
from app.repositories.mongodb.response import MongoResponseRepository
from app.repositories.mongodb.forecast import MongoForecastRepository
from app.repositories.mongodb.outcome import MongoOutcomeRepository
from app.repositories.mongodb.schedule import MongoScheduleRepository
from app.repositories.mongodb.notification import MongoNotificationRepository
from app.repositories.mongodb.report import MongoReportRepository
from app.repositories.mongodb.setting import MongoSettingsRepository

__all__ = [
    "IBaseRepository",
    "IUserRepository",
    "IMenuRepository",
    "IMealRepository",
    "IResponseRepository",
    "IForecastRepository",
    "IOutcomeRepository",
    "IScheduleRepository",
    "INotificationRepository",
    "IReportRepository",
    "ISettingsRepository",
    "SqliteUserRepository",
    "SqliteMenuRepository",
    "SqliteMealRepository",
    "SqliteResponseRepository",
    "SqliteForecastRepository",
    "SqliteOutcomeRepository",
    "SqliteScheduleRepository",
    "SqliteNotificationRepository",
    "SqliteReportRepository",
    "SqliteSettingsRepository",
    "MongoUserRepository",
    "MongoMenuRepository",
    "MongoMealRepository",
    "MongoResponseRepository",
    "MongoForecastRepository",
    "MongoOutcomeRepository",
    "MongoScheduleRepository",
    "MongoNotificationRepository",
    "MongoReportRepository",
    "MongoSettingsRepository",
]
