"""
MessMate MongoDB Settings Repository Implementation
===================================================
Persists institutional configuration in MongoDB Atlas `institution_settings` collection.
"""

from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.setting import InstitutionSettingSchema, InstitutionSettingUpdate
from app.repositories.setting import ISettingsRepository
from app.core.config import settings
from app.core.timezone import validate_timezone_name


class MongoSettingsRepository(ISettingsRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.institution_settings

    def _doc_to_schema(self, doc: dict) -> InstitutionSettingSchema:
        margin_frac = float(doc.get("safety_margin_fraction", settings.DEFAULT_SAFETY_MARGIN))
        return InstitutionSettingSchema(
            id=str(doc.get("_id", "default")),
            institution_name=doc.get("institution_name", settings.INSTITUTION_NAME),
            timezone=doc.get("timezone", settings.TIMEZONE),
            safety_margin_fraction=margin_frac,
            safety_margin_percentage=round(margin_frac * 100, 1),
            updated_at=str(doc.get("updated_at", datetime.now(timezone.utc).isoformat())),
        )

    async def get_settings(self) -> InstitutionSettingSchema:
        doc = await self.collection.find_one({"_id": "default"})
        if not doc:
            default_doc = {
                "_id": "default",
                "institution_name": settings.INSTITUTION_NAME,
                "timezone": settings.TIMEZONE,
                "safety_margin_fraction": settings.DEFAULT_SAFETY_MARGIN,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            # Only persist default doc in isolated test databases, protecting production Atlas document count
            if self.db.name != settings.MONGODB_DATABASE:
                await self.collection.insert_one(default_doc)
            return self._doc_to_schema(default_doc)

        return self._doc_to_schema(doc)

    async def update_settings(
        self, update_data: InstitutionSettingUpdate
    ) -> InstitutionSettingSchema:
        doc = await self.collection.find_one({"_id": "default"})
        now_iso = datetime.now(timezone.utc).isoformat()

        current_name = doc.get("institution_name", settings.INSTITUTION_NAME) if doc else settings.INSTITUTION_NAME
        current_tz = doc.get("timezone", settings.TIMEZONE) if doc else settings.TIMEZONE
        current_margin = doc.get("safety_margin_fraction", settings.DEFAULT_SAFETY_MARGIN) if doc else settings.DEFAULT_SAFETY_MARGIN

        new_name = update_data.institution_name.strip() if update_data.institution_name and update_data.institution_name.strip() else current_name
        if update_data.timezone and update_data.timezone.strip():
            new_tz = validate_timezone_name(update_data.timezone.strip())
        else:
            new_tz = current_tz

        if update_data.safety_margin_percentage is not None:
            new_margin = round(update_data.safety_margin_percentage / 100.0, 4)
        elif update_data.safety_margin_fraction is not None:
            new_margin = round(update_data.safety_margin_fraction, 4)
        else:
            new_margin = current_margin

        updated_doc = {
            "_id": "default",
            "institution_name": new_name,
            "timezone": new_tz,
            "safety_margin_fraction": new_margin,
            "updated_at": now_iso,
        }

        await self.collection.update_one(
            {"_id": "default"},
            {"$set": updated_doc},
            upsert=True,
        )

        # Synchronize notification schedules with updated institutional timezone
        if update_data.timezone and update_data.timezone.strip():
            await self.db.notification_schedules.update_many({}, {"$set": {"timezone": new_tz}})

        return self._doc_to_schema(updated_doc)
