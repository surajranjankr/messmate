"""
MessMate MongoDB Student Response Repository Implementation
===========================================================
Implements IResponseRepository using Motor async driver against MongoDB Atlas.
Manages student responses with single response uniqueness and deadline enforcement.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.response import IResponseRepository
from app.schemas.response import MealResponseSchema, MealCountsSchema
from app.core.config import settings


class MongoResponseRepository(IResponseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.meal_responses

    def _to_schema(self, doc: dict) -> MealResponseSchema:
        created_str = doc.get("submitted_at") or doc.get("created_at") or ""
        updated_str = doc.get("updated_at") or created_str
        return MealResponseSchema(
            id=str(doc["_id"]),
            student_id=str(doc["student_id"]),
            meal_instance_id=str(doc["meal_instance_id"]),
            choice=doc["choice"],
            created_at=str(created_str),
            updated_at=str(updated_str),
        )

    async def get_by_student_and_meal(
        self, student_id: str, meal_instance_id: str
    ) -> Optional[MealResponseSchema]:
        doc = await self.collection.find_one({
            "student_id": student_id,
            "meal_instance_id": meal_instance_id,
        })
        return self._to_schema(doc) if doc else None

    async def save_response(
        self, student_id: str, meal_instance_id: str, choice: str
    ) -> MealResponseSchema:
        now_iso = datetime.now(timezone.utc).isoformat()
        existing = await self.collection.find_one({
            "student_id": student_id,
            "meal_instance_id": meal_instance_id,
        })

        if existing:
            await self.collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"choice": choice, "updated_at": now_iso}},
            )
            updated = await self.collection.find_one({"_id": existing["_id"]})
            return self._to_schema(updated)
        else:
            new_id = f"resp-{uuid.uuid4().hex[:8]}"
            new_doc = {
                "_id": new_id,
                "student_id": student_id,
                "meal_instance_id": meal_instance_id,
                "choice": choice,
                "submitted_at": now_iso,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            await self.collection.insert_one(new_doc)
            return self._to_schema(new_doc)

    async def get_history_by_student(
        self, student_id: str
    ) -> List[MealResponseSchema]:
        cursor = self.collection.find({"student_id": student_id}).sort("submitted_at", -1)
        docs = await cursor.to_list(length=1000)
        return [self._to_schema(d) for d in docs]

    async def get_counts_by_meal(
        self, meal_instance_id: str
    ) -> MealCountsSchema:
        # Dynamically query eligible active students
        cursor = self.db.users.find(
            {"role": "STUDENT", "status": "ACTIVE"},
            {"_id": 1}
        )
        eligible_docs = await cursor.to_list(length=100000)
        eligible_ids = {str(d["_id"]) for d in eligible_docs}
        total_eligible = len(eligible_ids)

        if total_eligible == 0:
            return MealCountsSchema(
                definitely_eating=0,
                probably_eating=0,
                not_eating=0,
                no_response=0,
                total_registered=0,
            )

        resp_cursor = self.collection.find({
            "meal_instance_id": meal_instance_id,
            "student_id": {"$in": list(eligible_ids)},
        })
        docs = await resp_cursor.to_list(length=100000)

        # Deduplicate per student to guarantee unique count
        unique_responses = {str(d.get("student_id")): d.get("choice") for d in docs}

        definitely = sum(1 for c in unique_responses.values() if c == "DEFINITELY_EATING")
        probably = sum(1 for c in unique_responses.values() if c == "PROBABLY_EATING")
        not_eating = sum(1 for c in unique_responses.values() if c == "NOT_EATING")

        total_responded = definitely + probably + not_eating
        no_response = max(0, total_eligible - total_responded)

        return MealCountsSchema(
            definitely_eating=definitely,
            probably_eating=probably,
            not_eating=not_eating,
            no_response=no_response,
            total_registered=total_eligible,
        )
