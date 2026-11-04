"""
MessMate MongoDB Meal Repository Implementation
==============================================
Implements IMealRepository using Motor async driver against MongoDB Atlas.
Manages meal instance retrieval, sorting, and deadline-driven status transitions.
"""

from datetime import datetime, timezone, date
from zoneinfo import ZoneInfo
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.meal import IMealRepository
from app.schemas.meal import MealInstanceSchema
from app.core.config import settings
from app.core.timezone import (
    get_institution_timezone,
    get_institution_today_str,
    calculate_meal_response_window,
    evaluate_meal_window_status,
)


class MongoMealRepository(IMealRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.meal_instances

    async def _get_institution_tz(self) -> ZoneInfo:
        doc = await self.db.institution_settings.find_one({"_id": "default"})
        tz_str = doc.get("timezone", settings.TIMEZONE) if doc else settings.TIMEZONE
        return get_institution_timezone(tz_str)

    async def _refresh_statuses(self, docs: List[dict]) -> List[dict]:
        now = datetime.now(timezone.utc)
        inst_tz = await self._get_institution_tz()
        for doc in docs:
            curr_status = doc.get("status")
            if curr_status == "COMPLETED":
                continue

            meal_date = doc.get("meal_date", "")
            meal_type = doc.get("meal_type", "")
            sched_doc = None
            try:
                d = date.fromisoformat(meal_date)
                weekday = d.strftime("%A").upper()
                sched_doc = await self.db.notification_schedules.find_one({
                    "day_of_week": weekday,
                    "meal_type": meal_type,
                })
            except Exception:
                pass

            try:
                class FakeSched:
                    pass
                sched_obj = None
                if sched_doc:
                    sched_obj = FakeSched()
                    sched_obj.notify_send_time = sched_doc.get("notify_send_time")
                    sched_obj.response_deadline_time = sched_doc.get("response_deadline_time")
                    sched_obj.meal_date_offset = sched_doc.get("meal_date_offset")

                open_utc, close_utc, open_iso, close_iso = calculate_meal_response_window(
                    meal_date=meal_date,
                    meal_type=meal_type,
                    response_open_time=doc.get("response_open_time"),
                    response_deadline=doc.get("response_deadline"),
                    schedule=sched_obj,
                    tz=inst_tz,
                )

                updates = {}
                if not doc.get("response_open_time"):
                    doc["response_open_time"] = open_iso
                    updates["response_open_time"] = open_iso

                new_status = evaluate_meal_window_status(now, open_utc, close_utc)
                if new_status != curr_status:
                    doc["status"] = new_status
                    updates["status"] = new_status

                if updates and self.db.name != settings.MONGODB_DATABASE:
                    await self.collection.update_one(
                        {"_id": doc["_id"]},
                        {"$set": updates},
                    )
            except Exception:
                continue

        return docs

    def _to_schema(self, doc: dict) -> MealInstanceSchema:
        return MealInstanceSchema(
            id=str(doc["_id"]),
            meal_date=str(doc.get("meal_date", "")),
            meal_type=str(doc.get("meal_type", "")),
            menu_version_id=str(doc.get("menu_version_id", "")),
            response_deadline=str(doc.get("response_deadline", "")),
            response_open_time=doc.get("response_open_time"),
            status=str(doc.get("status", "UPCOMING")),
        )

    async def get_all(self) -> List[MealInstanceSchema]:
        cursor = self.collection.find({})
        docs = await cursor.to_list(length=1000)
        refreshed = await self._refresh_statuses(docs)
        return [self._to_schema(d) for d in refreshed]

    async def get_today(self) -> List[MealInstanceSchema]:
        inst_tz = await self._get_institution_tz()
        today_str = get_institution_today_str(inst_tz)
        cursor = self.collection.find({"meal_date": today_str})
        docs = await cursor.to_list(length=100)
        refreshed = await self._refresh_statuses(docs)
        return [self._to_schema(d) for d in refreshed]

    async def get_actionable(self) -> Optional[MealInstanceSchema]:
        cursor = self.collection.find({})
        docs = await cursor.to_list(length=1000)
        refreshed = await self._refresh_statuses(docs)

        MEAL_ORDER = {"BREAKFAST": 1, "LUNCH": 2, "SNACKS": 3, "DINNER": 4}
        today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # 1. Today's uncompleted meals (both RESPONSE_OPEN and RESPONSE_CLOSED)
        todays = [d for d in refreshed if d.get("meal_date") == today_iso and d.get("status") != "COMPLETED"]
        if todays:
            todays.sort(key=lambda x: MEAL_ORDER.get(x.get("meal_type"), 99))
            open_today = [d for d in todays if d.get("status") == "RESPONSE_OPEN"]
            if open_today:
                return self._to_schema(open_today[0])
            closed_today = [d for d in todays if d.get("status") == "RESPONSE_CLOSED"]
            if closed_today:
                return self._to_schema(closed_today[-1])
            return self._to_schema(todays[0])

        open_meals = [d for d in refreshed if d.get("status") == "RESPONSE_OPEN"]
        if open_meals:
            open_meals.sort(key=lambda x: x.get("response_deadline", ""))
            return self._to_schema(open_meals[0])

        upcoming = [d for d in refreshed if d.get("status") == "UPCOMING"]
        if upcoming:
            upcoming.sort(key=lambda x: (x.get("meal_date", ""), MEAL_ORDER.get(x.get("meal_type"), 99)))
            return self._to_schema(upcoming[0])

        remaining = [d for d in refreshed if d.get("status") != "COMPLETED"]
        if remaining:
            remaining.sort(key=lambda x: (x.get("meal_date", ""), MEAL_ORDER.get(x.get("meal_type"), 99)))
            return self._to_schema(remaining[0])

        return None

    async def get_by_id(self, meal_id: str) -> Optional[MealInstanceSchema]:
        doc = await self.collection.find_one({"_id": meal_id})
        if not doc:
            return None
        refreshed = await self._refresh_statuses([doc])
        return self._to_schema(refreshed[0])

    async def update_status(self, meal_id: str, new_status: str) -> None:
        await self.collection.update_one(
            {"_id": meal_id},
            {"$set": {"status": new_status}},
        )
