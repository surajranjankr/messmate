"""
MessMate SQLite Schedule Repository Implementation
==================================================
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.schedule import NotificationSchedule
from app.schemas.schedule import (
    NotificationScheduleSchema,
    ScheduleUpdateRequest,
    ScheduleValidationResult,
)
from app.repositories.schedule import IScheduleRepository
from app.repositories.schedule_validator import validate_schedules


class SqliteScheduleRepository(IScheduleRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_schema(self, s: NotificationSchedule) -> NotificationScheduleSchema:
        return NotificationScheduleSchema(
            id=s.id,
            day_of_week=s.day_of_week,
            meal_type=s.meal_type,
            enabled=s.enabled,
            notify_send_time=s.notify_send_time,
            response_deadline_time=s.response_deadline_time,
            meal_date_offset=s.meal_date_offset,
            timezone=s.timezone,
            overlap_acknowledged=s.overlap_acknowledged,
        )

    async def get_all(self) -> List[NotificationScheduleSchema]:
        schedules = self.db.query(NotificationSchedule).all()
        return [self._to_schema(s) for s in schedules]

    async def get_by_id(self, schedule_id: str) -> Optional[NotificationScheduleSchema]:
        sched = self.db.query(NotificationSchedule).filter(NotificationSchedule.id == schedule_id).first()
        return self._to_schema(sched) if sched else None

    async def update(
        self, schedule_id: str, request: ScheduleUpdateRequest
    ) -> NotificationScheduleSchema:
        sched = self.db.query(NotificationSchedule).filter(NotificationSchedule.id == schedule_id).first()
        if not sched:
            raise KeyError(f"Schedule {schedule_id} not found.")

        if request.notify_send_time is not None:
            sched.notify_send_time = request.notify_send_time
        if request.response_deadline_time is not None:
            sched.response_deadline_time = request.response_deadline_time
        if request.meal_date_offset is not None:
            sched.meal_date_offset = request.meal_date_offset
        if request.enabled is not None:
            sched.enabled = request.enabled
        if request.overlap_acknowledged is not None:
            sched.overlap_acknowledged = request.overlap_acknowledged

        all_schedules = self.db.query(NotificationSchedule).all()
        val = validate_schedules(all_schedules)
        for err in val.errors:
            if err.schedule_id == sched.id:
                raise ValueError(err.message)

        self.db.commit()
        self.db.refresh(sched)
        return self._to_schema(sched)

    async def validate(self) -> ScheduleValidationResult:
        all_schedules = self.db.query(NotificationSchedule).all()
        return validate_schedules(all_schedules)

    async def acknowledge_overlap(
        self, schedule_ids: List[str], acknowledged: bool
    ) -> int:
        schedules = self.db.query(NotificationSchedule).filter(NotificationSchedule.id.in_(schedule_ids)).all()
        if not schedules:
            return 0
        for s in schedules:
            s.overlap_acknowledged = acknowledged
        self.db.commit()
        return len(schedules)
