"""
MessMate MongoDB Connection & Collection Management
===================================================
Provides asynchronous MongoDB connectivity via Motor, connection pooling,
index initialization, and health checks for MongoDB Atlas.
"""

import asyncio
from typing import Optional
import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from app.core.config import settings

_mongo_client: Optional[AsyncIOMotorClient] = None


def get_mongo_client() -> AsyncIOMotorClient:
    """Returns or initializes the global AsyncIOMotorClient with connection pooling and loop safety."""
    global _mongo_client

    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _mongo_client is not None:
        try:
            client_loop = _mongo_client.get_io_loop()
            if client_loop.is_closed() or (current_loop and client_loop != current_loop):
                _mongo_client.close()
                _mongo_client = None
        except Exception:
            _mongo_client = None

    if _mongo_client is None:
        if not settings.MONGODB_URI:
            raise ValueError(
                "MONGODB_URI is not configured in environment. "
                "Configure MONGODB_URI in backend/.env to connect to MongoDB Atlas."
            )
        _mongo_client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            tlsCAFile=certifi.where(),
            maxPoolSize=50,
            minPoolSize=5,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
            appname="MessMateAPI",
        )
    return _mongo_client


def get_mongo_db() -> AsyncIOMotorDatabase:
    """Returns the configured MongoDB database instance."""
    client = get_mongo_client()
    return client[settings.MONGODB_DATABASE]


async def close_mongo_client() -> None:
    """Gracefully closes all MongoDB client connection pool sockets."""
    global _mongo_client
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None


async def check_mongo_health() -> dict:
    """Verifies cluster connectivity by issuing an administrative ping command."""
    if not settings.MONGODB_URI:
        return {"connected": False, "status": "UNCONFIGURED", "detail": "MONGODB_URI is empty"}
    try:
        client = get_mongo_client()
        res = await client.admin.command("ping")
        return {"connected": True, "status": "HEALTHY", "detail": res}
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        return {"connected": False, "status": "UNREACHABLE", "detail": str(err)}
    except Exception as exc:
        return {"connected": False, "status": "ERROR", "detail": str(exc)}


async def init_mongo_indexes(db: AsyncIOMotorDatabase) -> None:
    """
    Initializes required compound and unique indexes across collections
    to guarantee domain integrity rules in MongoDB.
    """
    # 1. users
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")

    # 2. menu_versions
    await db.menu_versions.create_index("version_number", unique=True)
    await db.menu_versions.create_index("status")

    # 3. meal_instances
    await db.meal_instances.create_index("meal_date")
    await db.meal_instances.create_index(
        [("meal_date", 1), ("meal_type", 1)], unique=True
    )
    await db.meal_instances.create_index("status")

    # 4. meal_responses (CRITICAL: 1 response per student per meal instance)
    await db.meal_responses.create_index(
        [("student_id", 1), ("meal_instance_id", 1)], unique=True
    )
    await db.meal_responses.create_index("meal_instance_id")

    # 5. notification_schedules
    await db.notification_schedules.create_index(
        [("day_of_week", 1), ("meal_type", 1)], unique=True
    )

    # 6. notifications
    await db.notifications.create_index([("user_id", 1), ("is_read", 1)])
