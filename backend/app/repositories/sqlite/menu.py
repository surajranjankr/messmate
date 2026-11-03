"""
MessMate SQLite Menu Repository Implementation
==============================================
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models.menu import MenuVersion, MenuMealEntry, DishItem
from app.schemas.menu import (
    MenuVersionSchema,
    MenuMealEntrySchema,
    DishItemSchema,
    DraftSaveRequest,
    PublishRequest,
)
from app.repositories.menu import IMenuRepository


class SqliteMenuRepository(IMenuRepository):
    def __init__(self, db: Session):
        self.db = db

    def _serialize_version(self, version: MenuVersion) -> MenuVersionSchema:
        meals = []
        for m in (version.meals or []):
            dishes = [
                DishItemSchema(
                    id=d.id,
                    name=d.name,
                    alternatives=d.alternatives or [],
                    category=d.category,
                )
                for d in (m.dishes or [])
            ]
            meals.append(
                MenuMealEntrySchema(
                    id=m.id,
                    day_of_week=m.day_of_week,
                    meal_type=m.meal_type,
                    dishes=dishes,
                    accompaniments=m.accompaniments or [],
                    notes=m.notes or [],
                )
            )
        return MenuVersionSchema(
            id=version.id,
            version_number=version.version_number,
            status=version.status,
            meals=meals,
            created_at=version.created_at.isoformat() if version.created_at else "",
            published_at=version.published_at.isoformat() if version.published_at else None,
            change_summary=version.change_summary,
        )

    async def get_published(self) -> Optional[MenuVersionSchema]:
        version = (
            self.db.query(MenuVersion)
            .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
            .filter(MenuVersion.status == "PUBLISHED")
            .first()
        )
        return self._serialize_version(version) if version else None

    async def get_draft(self) -> Optional[MenuVersionSchema]:
        version = (
            self.db.query(MenuVersion)
            .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
            .filter(MenuVersion.status == "DRAFT")
            .first()
        )
        return self._serialize_version(version) if version else None

    async def get_by_id(self, version_id: str) -> Optional[MenuVersionSchema]:
        version = (
            self.db.query(MenuVersion)
            .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
            .filter(MenuVersion.id == version_id)
            .first()
        )
        return self._serialize_version(version) if version else None

    async def save_draft(self, request: DraftSaveRequest) -> MenuVersionSchema:
        draft = self.db.query(MenuVersion).filter(MenuVersion.status == "DRAFT").first()
        published = self.db.query(MenuVersion).filter(MenuVersion.status == "PUBLISHED").first()
        next_version = (published.version_number + 1) if published else 1

        if not draft:
            draft = MenuVersion(
                id=f"menu-draft-{uuid.uuid4().hex[:8]}",
                version_number=next_version,
                status="DRAFT",
                change_summary=request.change_summary or "Work in progress",
                created_at=datetime.now(timezone.utc),
            )
            self.db.add(draft)
            self.db.commit()
            self.db.refresh(draft)

            if not request.meals and published:
                for p_meal in published.meals:
                    entry_id = f"entry-{draft.id}-{p_meal.day_of_week.lower()}-{p_meal.meal_type.lower()}"
                    entry = MenuMealEntry(
                        id=entry_id,
                        menu_version_id=draft.id,
                        day_of_week=p_meal.day_of_week,
                        meal_type=p_meal.meal_type,
                        accompaniments=p_meal.accompaniments,
                        notes=p_meal.notes,
                    )
                    self.db.add(entry)
                    self.db.commit()
                    for p_dish in p_meal.dishes:
                        dish = DishItem(
                            id=f"dish-{uuid.uuid4().hex[:8]}",
                            menu_meal_entry_id=entry_id,
                            name=p_dish.name,
                            alternatives=p_dish.alternatives,
                            category=p_dish.category,
                        )
                        self.db.add(dish)
                    self.db.commit()
        else:
            self.db.query(MenuMealEntry).filter(MenuMealEntry.menu_version_id == draft.id).delete()
            draft.change_summary = request.change_summary or draft.change_summary
            self.db.commit()

        if request.meals:
            for meal_schema in request.meals:
                entry_id = f"entry-{draft.id}-{meal_schema.day_of_week.lower()}-{meal_schema.meal_type.lower()}"
                entry = MenuMealEntry(
                    id=entry_id,
                    menu_version_id=draft.id,
                    day_of_week=meal_schema.day_of_week,
                    meal_type=meal_schema.meal_type,
                    accompaniments=meal_schema.accompaniments,
                    notes=meal_schema.notes,
                )
                self.db.add(entry)
                self.db.commit()

                for d_schema in meal_schema.dishes:
                    dish = DishItem(
                        id=d_schema.id if d_schema.id else f"dish-{uuid.uuid4().hex[:8]}",
                        menu_meal_entry_id=entry_id,
                        name=d_schema.name,
                        alternatives=d_schema.alternatives,
                        category=d_schema.category,
                    )
                    self.db.add(dish)
                self.db.commit()

        refreshed = (
            self.db.query(MenuVersion)
            .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
            .filter(MenuVersion.id == draft.id)
            .first()
        )
        return self._serialize_version(refreshed)

    async def discard_draft(self) -> None:
        draft = self.db.query(MenuVersion).filter(MenuVersion.status == "DRAFT").first()
        if draft:
            self.db.delete(draft)
            self.db.commit()

    async def publish_draft(self, request: PublishRequest) -> MenuVersionSchema:
        draft = self.db.query(MenuVersion).filter(MenuVersion.status == "DRAFT").first()
        if not draft:
            raise ValueError("No draft menu exists to publish.")

        current_published = self.db.query(MenuVersion).filter(MenuVersion.status == "PUBLISHED").first()
        next_ver_num = (current_published.version_number + 1) if current_published else 1

        if current_published:
            current_published.status = "ARCHIVED"

        draft.status = "PUBLISHED"
        draft.version_number = next_ver_num
        draft.published_at = datetime.now(timezone.utc)
        draft.change_summary = request.change_summary or "Published menu version update"
        self.db.commit()

        published_version = (
            self.db.query(MenuVersion)
            .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
            .filter(MenuVersion.id == draft.id)
            .first()
        )
        return self._serialize_version(published_version)

    async def get_history(self) -> List[MenuVersionSchema]:
        versions = (
            self.db.query(MenuVersion)
            .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
            .order_by(MenuVersion.version_number.desc())
            .all()
        )
        return [self._serialize_version(v) for v in versions]

    async def get_meal_entry(
        self, day_of_week: str, meal_type: str, version_id: Optional[str] = None
    ) -> Optional[MenuMealEntrySchema]:
        query = (
            self.db.query(MenuMealEntry)
            .options(joinedload(MenuMealEntry.dishes))
            .filter(
                MenuMealEntry.day_of_week == day_of_week.upper(),
                MenuMealEntry.meal_type == meal_type.upper(),
            )
        )
        if version_id:
            query = query.filter(MenuMealEntry.menu_version_id == version_id)
        else:
            published = self.db.query(MenuVersion).filter(MenuVersion.status == "PUBLISHED").first()
            if not published:
                return None
            query = query.filter(MenuMealEntry.menu_version_id == published.id)

        entry = query.first()
        if not entry:
            return None

        dishes = [
            DishItemSchema(
                id=d.id,
                name=d.name,
                alternatives=d.alternatives or [],
                category=d.category,
            )
            for d in entry.dishes
        ]
        return MenuMealEntrySchema(
            id=entry.id,
            day_of_week=entry.day_of_week,
            meal_type=entry.meal_type,
            dishes=dishes,
            accompaniments=entry.accompaniments or [],
            notes=entry.notes or [],
        )
