"""
MessMate MongoDB Schedule Repository Implementation
===================================================
Implements IScheduleRepository using Motor async driver against MongoDB Atlas.
Manages notification schedules and cross-schedule validation in `notification_schedules`.
"""

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.schedule import IScheduleRepository
from app.schemas.schedule import (
    NotificationScheduleSchema,
    ScheduleUpdateRequest,
    ScheduleValidationResult,
)
from app.repositories.schedule_validator import validate_schedules


class MongoScheduleRepository(IScheduleRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.notification_schedules

    def _to_schema(self, doc: dict) -> NotificationScheduleSchema:
        return NotificationScheduleSchema(
            id=str(doc["_id"]),
            day_of_week=doc.get("day_of_week", ""),
            meal_type=doc.get("meal_type", ""),
            enabled=bool(doc.get("enabled", True)),
            notify_send_time=doc.get("notify_send_time", ""),
            response_deadline_time=doc.get("response_deadline_time", ""),
            meal_date_offset=int(doc.get("meal_date_offset", 0)),
            timezone=doc.get("timezone", "Asia/Kolkata"),
            overlap_acknowledged=bool(doc.get("overlap_acknowledged", False)),
        )

    async def get_all(self) -> List[NotificationScheduleSchema]:
        cursor = self.collection.find({})
        docs = await cursor.to_list(length=100)
        return [self._to_schema(d) for d in docs]

    async def get_by_id(self, schedule_id: str) -> Optional[NotificationScheduleSchema]:
        doc = await self.collection.find_one({"_id": schedule_id})
        return self._to_schema(doc) if doc else None

    async def update(
        self, schedule_id: str, request: ScheduleUpdateRequest
    ) -> NotificationScheduleSchema:
        doc = await self.collection.find_one({"_id": schedule_id})
        if not doc:
            raise KeyError(f"Schedule {schedule_id} not found.")

        update_fields = {}
        if request.notify_send_time is not None:
            update_fields["notify_send_time"] = request.notify_send_time
        if request.response_deadline_time is not None:
            update_fields["response_deadline_time"] = request.response_deadline_time
        if request.meal_date_offset is not None:
            update_fields["meal_date_offset"] = request.meal_date_offset
        if request.enabled is not None:
            update_fields["enabled"] = request.enabled
        if request.overlap_acknowledged is not None:
            update_fields["overlap_acknowledged"] = request.overlap_acknowledged

        cursor = self.collection.find({})
        all_docs = await cursor.to_list(length=100)
        # Apply proposed changes in-memory to validate
        for d in all_docs:
            if str(d["_id"]) == schedule_id:
                d.update(update_fields)
                d["id"] = d["_id"]
            else:
                d["id"] = d["_id"]

        val = validate_schedules(all_docs)
        for err in val.errors:
            if err.schedule_id == schedule_id:
                raise ValueError(err.message)

        if update_fields:
            await self.collection.update_one({"_id": schedule_id}, {"$set": update_fields})

        updated = await self.collection.find_one({"_id": schedule_id})
        return self._to_schema(updated)

    async def validate(self) -> ScheduleValidationResult:
        cursor = self.collection.find({})
        all_docs = await cursor.to_list(length=100)
        for d in all_docs:
            d["id"] = d["_id"]
        return validate_schedules(all_docs)

    async def acknowledge_overlap(
        self, schedule_ids: List[str], acknowledged: bool
    ) -> int:
        result = await self.collection.update_many(
            {"_id": {"$in": schedule_ids}},
            {"$set": {"overlap_acknowledged": acknowledged}},
        )
        return result.modified_count
