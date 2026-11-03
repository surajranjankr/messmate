"""
MessMate SQLite Settings Repository Implementation
==================================================
Persists institutional configuration in SQLite `institution_settings` table.
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.setting import InstitutionSetting
from app.models.schedule import NotificationSchedule
from app.schemas.setting import InstitutionSettingSchema, InstitutionSettingUpdate
from app.repositories.setting import ISettingsRepository
from app.core.config import settings
from app.core.timezone import validate_timezone_name


class SqliteSettingsRepository(ISettingsRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_schema(self, setting: InstitutionSetting) -> InstitutionSettingSchema:
        margin_frac = float(setting.safety_margin_fraction)
        return InstitutionSettingSchema(
            id=setting.id,
            institution_name=setting.institution_name,
            timezone=setting.timezone,
            safety_margin_fraction=margin_frac,
            safety_margin_percentage=round(margin_frac * 100, 1),
            updated_at=(
                setting.updated_at.isoformat()
                if hasattr(setting.updated_at, "isoformat")
                else str(setting.updated_at)
            ),
        )

    async def get_settings(self) -> InstitutionSettingSchema:
        setting = self.db.query(InstitutionSetting).filter(InstitutionSetting.id == "default").first()
        if not setting:
            setting = InstitutionSetting(
                id="default",
                institution_name=settings.INSTITUTION_NAME,
                timezone=settings.TIMEZONE,
                safety_margin_fraction=settings.DEFAULT_SAFETY_MARGIN,
                updated_at=datetime.now(timezone.utc),
            )
            self.db.add(setting)
            self.db.commit()
            self.db.refresh(setting)

        return self._to_schema(setting)

    async def update_settings(
        self, update_data: InstitutionSettingUpdate
    ) -> InstitutionSettingSchema:
        setting = self.db.query(InstitutionSetting).filter(InstitutionSetting.id == "default").first()
        now = datetime.now(timezone.utc)
        if not setting:
            setting = InstitutionSetting(
                id="default",
                institution_name=settings.INSTITUTION_NAME,
                timezone=settings.TIMEZONE,
                safety_margin_fraction=settings.DEFAULT_SAFETY_MARGIN,
                updated_at=now,
            )
            self.db.add(setting)

        if update_data.institution_name is not None and update_data.institution_name.strip():
            setting.institution_name = update_data.institution_name.strip()

        if update_data.timezone is not None and update_data.timezone.strip():
            clean_tz = validate_timezone_name(update_data.timezone.strip())
            setting.timezone = clean_tz
            # Synchronize notification schedules with updated institutional timezone
            self.db.query(NotificationSchedule).update({"timezone": clean_tz})

        # Handle margin from percentage or fraction
        if update_data.safety_margin_percentage is not None:
            setting.safety_margin_fraction = round(update_data.safety_margin_percentage / 100.0, 4)
        elif update_data.safety_margin_fraction is not None:
            setting.safety_margin_fraction = round(update_data.safety_margin_fraction, 4)

        setting.updated_at = now
        self.db.commit()
        self.db.refresh(setting)

        return self._to_schema(setting)
