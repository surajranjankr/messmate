"""
MessMate Schedule Validator Helper
==================================
Shared validation logic for notification schedules across SQLite and MongoDB.
"""

from typing import List, Any
from app.schemas.schedule import (
    ScheduleValidationResult,
    ScheduleValidationError,
    ScheduleOverlapWarning,
)


def time_to_minutes(time_str: str) -> int:
    """Convert HH:MM to minutes since midnight."""
    try:
        parts = time_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0


def validate_schedules(schedules: List[Any]) -> ScheduleValidationResult:
    """Validate notification schedules for missing times, ordering, and overlapping windows."""
    errors: List[ScheduleValidationError] = []
    warnings: List[ScheduleOverlapWarning] = []

    # Helper to get field regardless of whether item is model or dict/schema
    def get_attr(item, attr, default=None):
        if isinstance(item, dict):
            return item.get(attr, default)
        return getattr(item, attr, default)

    # 1. Individual field validations
    for s in schedules:
        enabled = get_attr(s, "enabled", True)
        if not enabled:
            continue

        sid = str(get_attr(s, "id", ""))
        send_time = get_attr(s, "notify_send_time", "")
        deadline_time = get_attr(s, "response_deadline_time", "")
        day_of_week = get_attr(s, "day_of_week", "")
        meal_type = get_attr(s, "meal_type", "")
        offset = get_attr(s, "meal_date_offset", 0)

        if not send_time or not send_time.strip():
            errors.append(
                ScheduleValidationError(
                    schedule_id=sid,
                    field="notifySendTime",
                    message=f"Send time is required for {day_of_week} {meal_type}.",
                )
            )

        if not deadline_time or not deadline_time.strip():
            errors.append(
                ScheduleValidationError(
                    schedule_id=sid,
                    field="responseDeadlineTime",
                    message=f"Deadline time is required for {day_of_week} {meal_type}.",
                )
            )

        if send_time and deadline_time:
            send_m = time_to_minutes(send_time)
            dead_m = time_to_minutes(deadline_time)
            if offset == 0 and dead_m <= send_m:
                errors.append(
                    ScheduleValidationError(
                        schedule_id=sid,
                        field="responseDeadlineTime",
                        message=f"Deadline ({deadline_time}) must be after notification send time ({send_time}) on the same day.",
                    )
                )

    # 2. Window overlap detection on the same weekday
    for i in range(len(schedules)):
        s1 = schedules[i]
        if not get_attr(s1, "enabled", True):
            continue
        for j in range(i + 1, len(schedules)):
            s2 = schedules[j]
            if not get_attr(s2, "enabled", True):
                continue

            day1 = get_attr(s1, "day_of_week")
            day2 = get_attr(s2, "day_of_week")
            offset1 = get_attr(s1, "meal_date_offset", 0)
            offset2 = get_attr(s2, "meal_date_offset", 0)

            if day1 == day2 and offset1 == offset2:
                s1_send = get_attr(s1, "notify_send_time")
                s1_dead = get_attr(s1, "response_deadline_time")
                s2_send = get_attr(s2, "notify_send_time")
                s2_dead = get_attr(s2, "response_deadline_time")

                if not (s1_send and s1_dead and s2_send and s2_dead):
                    continue

                s1_start = time_to_minutes(s1_send)
                s1_end = time_to_minutes(s1_dead)
                s2_start = time_to_minutes(s2_send)
                s2_end = time_to_minutes(s2_dead)

                if max(s1_start, s2_start) < min(s1_end, s2_end):
                    meal1 = get_attr(s1, "meal_type")
                    meal2 = get_attr(s2, "meal_type")
                    label1 = f"{day1} {meal1} ({s1_send} - {s1_dead})"
                    label2 = f"{day2} {meal2} ({s2_send} - {s2_dead})"
                    is_ack = bool(get_attr(s1, "overlap_acknowledged", False) and get_attr(s2, "overlap_acknowledged", False))

                    warnings.append(
                        ScheduleOverlapWarning(
                            schedule1_id=str(get_attr(s1, "id")),
                            schedule2_id=str(get_attr(s2, "id")),
                            schedule1_label=label1,
                            schedule2_label=label2,
                            overlap_description=f"Response windows overlap between {label1} and {label2}. Students will have multiple concurrent response windows open.",
                            acknowledged=is_ack,
                        )
                    )

    return ScheduleValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )
