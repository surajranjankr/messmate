"""
MessMate MongoDB Notification Repository Implementation
=======================================================
Implements INotificationRepository using Motor async driver against MongoDB Atlas.
Manages user-specific and broadcast notifications in `notifications` collection.
"""

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.notification import INotificationRepository
from app.schemas.notification import NotificationSchema


class MongoNotificationRepository(INotificationRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.notifications

    def _to_schema(self, doc: dict) -> NotificationSchema:
        return NotificationSchema(
            id=str(doc["_id"]),
            title=doc.get("title", ""),
            message=doc.get("message", ""),
            created_at=str(doc.get("created_at", "")),
            is_read=bool(doc.get("is_read", False)),
            meal_instance_id=str(doc["meal_instance_id"]) if doc.get("meal_instance_id") else None,
        )

    async def get_for_user(self, user_id: str) -> List[NotificationSchema]:
        query = {"$or": [{"user_id": user_id}, {"user_id": None}]}
        cursor = self.collection.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=1000)
        return [self._to_schema(d) for d in docs]

    async def get_unread_count(self, user_id: str) -> int:
        query = {
            "$and": [
                {"$or": [{"user_id": user_id}, {"user_id": None}]},
                {"is_read": False},
            ]
        }
        return await self.collection.count_documents(query)

    async def mark_as_read(
        self, notification_id: str, user_id: str
    ) -> Optional[NotificationSchema]:
        doc = await self.collection.find_one({"_id": notification_id})
        if not doc:
            return None
        await self.collection.update_one(
            {"_id": notification_id},
            {"$set": {"is_read": True}},
        )
        updated = await self.collection.find_one({"_id": notification_id})
        return self._to_schema(updated)

    async def mark_all_as_read(self, user_id: str) -> int:
        query = {
            "$and": [
                {"$or": [{"user_id": user_id}, {"user_id": None}]},
                {"is_read": False},
            ]
        }
        result = await self.collection.update_many(
            query,
            {"$set": {"is_read": True}},
        )
        return result.modified_count
