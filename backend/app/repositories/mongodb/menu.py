"""
MessMate MongoDB Menu Repository Implementation
==============================================
Implements IMenuRepository using Motor async driver against MongoDB Atlas.
Operates on the hierarchical `menu_versions` collection.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.menu import IMenuRepository
from app.schemas.menu import (
    MenuVersionSchema,
    MenuMealEntrySchema,
    DishItemSchema,
    DraftSaveRequest,
    PublishRequest,
)


class MongoMenuRepository(IMenuRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.menu_versions

    def _to_schema(self, doc: dict) -> MenuVersionSchema:
        meals = []
        for m in doc.get("meals", []):
            dishes = [
                DishItemSchema(
                    id=str(d.get("id", "")),
                    name=d.get("name", ""),
                    alternatives=d.get("alternatives") or [],
                    category=d.get("category"),
                )
                for d in m.get("dishes", [])
            ]
            meals.append(
                MenuMealEntrySchema(
                    id=str(m.get("id", "")),
                    day_of_week=m.get("day_of_week", ""),
                    meal_type=m.get("meal_type", ""),
                    dishes=dishes,
                    accompaniments=m.get("accompaniments") or [],
                    notes=m.get("notes") or [],
                )
            )
        return MenuVersionSchema(
            id=str(doc["_id"]),
            version_number=doc.get("version_number", 1),
            status=doc.get("status", "DRAFT"),
            meals=meals,
            created_at=str(doc.get("created_at", "")),
            published_at=str(doc.get("published_at")) if doc.get("published_at") else None,
            change_summary=doc.get("change_summary"),
        )

    async def get_published(self) -> Optional[MenuVersionSchema]:
        doc = await self.collection.find_one({"status": "PUBLISHED"})
        return self._to_schema(doc) if doc else None

    async def get_draft(self) -> Optional[MenuVersionSchema]:
        doc = await self.collection.find_one({"status": "DRAFT"})
        return self._to_schema(doc) if doc else None

    async def get_by_id(self, version_id: str) -> Optional[MenuVersionSchema]:
        doc = await self.collection.find_one({"_id": version_id})
        return self._to_schema(doc) if doc else None

    async def save_draft(self, request: DraftSaveRequest) -> MenuVersionSchema:
        draft = await self.collection.find_one({"status": "DRAFT"})
        published = await self.collection.find_one({"status": "PUBLISHED"})
        next_version = (published["version_number"] + 1) if published else 1
        now_iso = datetime.now(timezone.utc).isoformat()

        formatted_meals = []
        if request.meals:
            for m in request.meals:
                entry_id = f"entry-draft-{m.day_of_week.lower()}-{m.meal_type.lower()}"
                dishes = [
                    {
                        "id": d.id if d.id else f"dish-{uuid.uuid4().hex[:8]}",
                        "name": d.name,
                        "alternatives": d.alternatives or [],
                        "category": d.category,
                    }
                    for d in m.dishes
                ]
                formatted_meals.append({
                    "id": entry_id,
                    "day_of_week": m.day_of_week.upper(),
                    "meal_type": m.meal_type.upper(),
                    "accompaniments": m.accompaniments or [],
                    "notes": m.notes or [],
                    "dishes": dishes,
                })

        if not draft:
            # If no meals provided in creation request, clone from current published version
            if not formatted_meals and published:
                formatted_meals = published.get("meals", [])

            draft_id = f"menu-draft-{uuid.uuid4().hex[:8]}"
            new_doc = {
                "_id": draft_id,
                "version_number": next_version,
                "status": "DRAFT",
                "change_summary": request.change_summary or "Work in progress",
                "created_at": now_iso,
                "published_at": None,
                "meals": formatted_meals,
            }
            await self.collection.insert_one(new_doc)
            return self._to_schema(new_doc)
        else:
            update_fields = {}
            if request.change_summary is not None:
                update_fields["change_summary"] = request.change_summary
            if request.meals:
                update_fields["meals"] = formatted_meals

            if update_fields:
                await self.collection.update_one({"_id": draft["_id"]}, {"$set": update_fields})
            updated_doc = await self.collection.find_one({"_id": draft["_id"]})
            return self._to_schema(updated_doc)

    async def discard_draft(self) -> None:
        await self.collection.delete_one({"status": "DRAFT"})

    async def publish_draft(self, request: PublishRequest) -> MenuVersionSchema:
        draft = await self.collection.find_one({"status": "DRAFT"})
        if not draft:
            raise ValueError("No draft menu exists to publish.")

        published = await self.collection.find_one({"status": "PUBLISHED"})
        next_ver_num = (published["version_number"] + 1) if published else 1
        now_iso = datetime.now(timezone.utc).isoformat()

        if published:
            await self.collection.update_one({"_id": published["_id"]}, {"$set": {"status": "ARCHIVED"}})

        await self.collection.update_one(
            {"_id": draft["_id"]},
            {
                "$set": {
                    "status": "PUBLISHED",
                    "version_number": next_ver_num,
                    "published_at": now_iso,
                    "change_summary": request.change_summary or "Published menu version update",
                }
            },
        )
        updated_draft = await self.collection.find_one({"_id": draft["_id"]})
        return self._to_schema(updated_draft)

    async def get_history(self) -> List[MenuVersionSchema]:
        cursor = self.collection.find({}).sort("version_number", -1)
        docs = await cursor.to_list(length=100)
        return [self._to_schema(d) for d in docs]

    async def get_meal_entry(
        self, day_of_week: str, meal_type: str, version_id: Optional[str] = None
    ) -> Optional[MenuMealEntrySchema]:
        if version_id:
            doc = await self.collection.find_one({"_id": version_id})
        else:
            doc = await self.collection.find_one({"status": "PUBLISHED"})

        if not doc:
            return None

        for m in doc.get("meals", []):
            if (
                m.get("day_of_week", "").upper() == day_of_week.upper()
                and m.get("meal_type", "").upper() == meal_type.upper()
            ):
                dishes = [
                    DishItemSchema(
                        id=str(d.get("id", "")),
                        name=d.get("name", ""),
                        alternatives=d.get("alternatives") or [],
                        category=d.get("category"),
                    )
                    for d in m.get("dishes", [])
                ]
                return MenuMealEntrySchema(
                    id=str(m.get("id", "")),
                    day_of_week=m.get("day_of_week", ""),
                    meal_type=m.get("meal_type", ""),
                    dishes=dishes,
                    accompaniments=m.get("accompaniments") or [],
                    notes=m.get("notes") or [],
                )
        return None
