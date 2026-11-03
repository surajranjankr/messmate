"""
MessMate MongoDB Outcome Repository Implementation
==================================================
Implements IOutcomeRepository using Motor async driver against MongoDB Atlas.
Reads and embeds post-meal `outcome` subdocuments directly within `meal_instances`.
"""

from datetime import datetime, timezone
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.outcome import IOutcomeRepository
from app.schemas.outcome import MealOutcomeSchema, MealOutcomeCreateRequest


class MongoOutcomeRepository(IOutcomeRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.meal_instances

    def _to_schema(self, meal_id: str, out: dict) -> MealOutcomeSchema:
        return MealOutcomeSchema(
            meal_instance_id=meal_id,
            actual_attendance=out.get("actual_attendance"),
            actual_prepared_quantity=out.get("actual_prepared_quantity"),
            prepared_unit=out.get("prepared_unit", "portions"),
            leftover_quantity=out.get("leftover_quantity"),
            leftover_unit=out.get("leftover_unit"),
            notes=out.get("notes"),
            recorded_at=str(out.get("recorded_at", "")),
        )

    async def get_all(self) -> List[MealOutcomeSchema]:
        cursor = self.collection.find({"outcome": {"$ne": None}}).sort("outcome.recorded_at", -1)
        docs = await cursor.to_list(length=1000)
        results = []
        for d in docs:
            out = d.get("outcome")
            if out:
                results.append(self._to_schema(str(d["_id"]), out))
        return results

    async def get_by_meal(self, meal_id: str) -> Optional[MealOutcomeSchema]:
        meal = await self.collection.find_one({"_id": meal_id})
        if not meal or not meal.get("outcome"):
            return None
        return self._to_schema(meal_id, meal["outcome"])

    async def save_outcome(
        self, meal_id: str, request: MealOutcomeCreateRequest
    ) -> MealOutcomeSchema:
        meal = await self.collection.find_one({"_id": meal_id})
        if not meal:
            raise KeyError(f"Meal instance {meal_id} not found.")

        now_iso = datetime.now(timezone.utc).isoformat()
        out_doc = {
            "actual_attendance": request.actual_attendance,
            "actual_prepared_quantity": request.actual_prepared_quantity,
            "prepared_unit": request.prepared_unit or "portions",
            "leftover_quantity": request.leftover_quantity,
            "leftover_unit": request.leftover_unit if request.leftover_quantity is not None else None,
            "notes": request.notes.strip() if request.notes else None,
            "recorded_at": now_iso,
        }

        await self.collection.update_one(
            {"_id": meal_id},
            {"$set": {"outcome": out_doc}},
        )

        return self._to_schema(meal_id, out_doc)
