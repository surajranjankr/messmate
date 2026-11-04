"""
MessMate SQLite Meal Repository Implementation
==============================================
"""

from datetime import datetime, timezone, date
from zoneinfo import ZoneInfo
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.meal import MealInstance
from app.models.setting import InstitutionSetting
from app.models.schedule import NotificationSchedule
from app.schemas.meal import MealInstanceSchema
from app.repositories.meal import IMealRepository
from app.core.config import settings
from app.core.timezone import (
    get_institution_timezone,
    get_institution_today_str,
    calculate_meal_response_window,
    evaluate_meal_window_status,
)


class SqliteMealRepository(IMealRepository):
    def __init__(self, db: Session):
        self.db = db

    def _get_institution_tz(self) -> ZoneInfo:
        setting = self.db.query(InstitutionSetting).filter(InstitutionSetting.id == "default").first()
        tz_str = setting.timezone if setting and setting.timezone else settings.TIMEZONE
        return get_institution_timezone(tz_str)

    def _refresh_statuses(self, instances: List[MealInstance]) -> List[MealInstance]:
        now = datetime.now(timezone.utc)
        inst_tz = self._get_institution_tz()
        changed = False

        for inst in instances:
            if inst.status == "COMPLETED":
                continue

            # Query schedule if available for this weekday and meal_type
            sched = None
            try:
                d = date.fromisoformat(inst.meal_date)
                weekday = d.strftime("%A").upper()
                sched = (
                    self.db.query(NotificationSchedule)
                    .filter(
                        NotificationSchedule.day_of_week == weekday,
                        NotificationSchedule.meal_type == inst.meal_type,
                    )
                    .first()
                )
            except Exception:
                pass

            try:
                open_utc, close_utc, open_iso, close_iso = calculate_meal_response_window(
                    meal_date=inst.meal_date,
                    meal_type=inst.meal_type,
                    response_open_time=getattr(inst, "response_open_time", None),
                    response_deadline=inst.response_deadline,
                    schedule=sched,
                    tz=inst_tz,
                )
                if not getattr(inst, "response_open_time", None):
                    inst.response_open_time = open_iso
                    changed = True

                new_status = evaluate_meal_window_status(now, open_utc, close_utc)
                if inst.status != new_status:
                    inst.status = new_status
                    changed = True
            except Exception:
                continue

        if changed:
            self.db.commit()

        return instances

    def _to_schema(self, inst: MealInstance) -> MealInstanceSchema:
        return MealInstanceSchema(
            id=inst.id,
            meal_date=inst.meal_date,
            meal_type=inst.meal_type,
            menu_version_id=inst.menu_version_id,
            response_deadline=inst.response_deadline,
            response_open_time=getattr(inst, "response_open_time", None),
            status=inst.status,
        )

    async def get_all(self) -> List[MealInstanceSchema]:
        instances = self.db.query(MealInstance).all()
        refreshed = self._refresh_statuses(instances)
        return [self._to_schema(i) for i in refreshed]

    async def get_today(self) -> List[MealInstanceSchema]:
        inst_tz = self._get_institution_tz()
        today_str = get_institution_today_str(inst_tz)
        instances = self.db.query(MealInstance).filter(MealInstance.meal_date == today_str).all()
        refreshed = self._refresh_statuses(instances)
        return [self._to_schema(i) for i in refreshed]

    async def get_actionable(self) -> Optional[MealInstanceSchema]:
        instances = self.db.query(MealInstance).all()
        refreshed = self._refresh_statuses(instances)

        MEAL_ORDER = {"BREAKFAST": 1, "LUNCH": 2, "SNACKS": 3, "DINNER": 4}
        inst_tz = self._get_institution_tz()
        today_str = get_institution_today_str(inst_tz)

        # 1. Today's uncompleted meals (both RESPONSE_OPEN and RESPONSE_CLOSED)
        todays = [i for i in refreshed if i.meal_date == today_str and i.status != "COMPLETED"]
        if todays:
            todays.sort(key=lambda x: MEAL_ORDER.get(x.meal_type, 99))
            open_today = [i for i in todays if i.status == "RESPONSE_OPEN"]
            if open_today:
                return self._to_schema(open_today[0])
            closed_today = [i for i in todays if i.status == "RESPONSE_CLOSED"]
            if closed_today:
                return self._to_schema(closed_today[-1])
            return self._to_schema(todays[0])

        open_meals = [i for i in refreshed if i.status == "RESPONSE_OPEN"]
        if open_meals:
            open_meals.sort(key=lambda x: x.response_deadline)
            return self._to_schema(open_meals[0])

        upcoming = [i for i in refreshed if i.status == "UPCOMING"]
        if upcoming:
            upcoming.sort(key=lambda x: (x.meal_date, MEAL_ORDER.get(x.meal_type, 99)))
            return self._to_schema(upcoming[0])

        remaining = [i for i in refreshed if i.status != "COMPLETED"]
        if remaining:
            remaining.sort(key=lambda x: (x.meal_date, MEAL_ORDER.get(x.meal_type, 99)))
            return self._to_schema(remaining[0])

        return None

    async def get_by_id(self, meal_id: str) -> Optional[MealInstanceSchema]:
        inst = self.db.query(MealInstance).filter(MealInstance.id == meal_id).first()
        if not inst:
            return None
        refreshed = self._refresh_statuses([inst])[0]
        return self._to_schema(refreshed)

    async def update_status(self, meal_id: str, new_status: str) -> None:
        inst = self.db.query(MealInstance).filter(MealInstance.id == meal_id).first()
        if inst:
            inst.status = new_status
            self.db.commit()
