from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.schedule import NotificationSchedule
from app.models.user import User
from app.schemas.schedule import (
    NotificationScheduleSchema,
    ScheduleUpdateRequest,
    ScheduleValidationResult,
    ScheduleValidationError,
    ScheduleOverlapWarning,
    AcknowledgeOverlapRequest,
)
from app.dependencies.auth import get_current_user, require_role

router = APIRouter(prefix="/schedules", tags=["Notification Schedules"])

def time_to_minutes(time_str: str) -> int:
    """Helper to convert HH:MM to minutes since midnight."""
    try:
        parts = time_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0

def validate_schedule_list(schedules: List[NotificationSchedule]) -> ScheduleValidationResult:
    """Validate notification schedules for missing times, ordering, and overlapping windows."""
    errors: List[ScheduleValidationError] = []
    warnings: List[ScheduleOverlapWarning] = []

    # 1. Individual field validations
    for s in schedules:
        if not s.enabled:
            continue

        if not s.notify_send_time or not s.notify_send_time.strip():
            errors.append(
                ScheduleValidationError(
                    schedule_id=s.id,
                    field="notifySendTime",
                    message=f"Send time is required for {s.day_of_week} {s.meal_type}.",
                )
            )

        if not s.response_deadline_time or not s.response_deadline_time.strip():
            errors.append(
                ScheduleValidationError(
                    schedule_id=s.id,
                    field="responseDeadlineTime",
                    message=f"Deadline time is required for {s.day_of_week} {s.meal_type}.",
                )
            )

        if s.notify_send_time and s.response_deadline_time:
            send_m = time_to_minutes(s.notify_send_time)
            dead_m = time_to_minutes(s.response_deadline_time)
            # Same day meals: deadline must be after send time
            if s.meal_date_offset == 0 and dead_m <= send_m:
                errors.append(
                    ScheduleValidationError(
                        schedule_id=s.id,
                        field="responseDeadlineTime",
                        message=f"Deadline ({s.response_deadline_time}) must be after notification send time ({s.notify_send_time}) on the same day.",
                    )
                )

    # 2. Window overlap detection on the same weekday
    for i in range(len(schedules)):
        s1 = schedules[i]
        if not s1.enabled:
            continue
        for j in range(i + 1, len(schedules)):
            s2 = schedules[j]
            if not s2.enabled:
                continue

            if s1.day_of_week == s2.day_of_week and s1.meal_date_offset == s2.meal_date_offset:
                s1_start = time_to_minutes(s1.notify_send_time)
                s1_end = time_to_minutes(s1.response_deadline_time)
                s2_start = time_to_minutes(s2.notify_send_time)
                s2_end = time_to_minutes(s2.response_deadline_time)

                # Overlap check
                if max(s1_start, s2_start) < min(s1_end, s2_end):
                    label1 = f"{s1.day_of_week} {s1.meal_type} ({s1.notify_send_time} - {s1.response_deadline_time})"
                    label2 = f"{s2.day_of_week} {s2.meal_type} ({s2.notify_send_time} - {s2.response_deadline_time})"
                    is_ack = bool(s1.overlap_acknowledged and s2.overlap_acknowledged)

                    warnings.append(
                        ScheduleOverlapWarning(
                            schedule1_id=s1.id,
                            schedule2_id=s2.id,
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

@router.get("", response_model=List[NotificationScheduleSchema])
def get_schedules(db: Session = Depends(get_db)):
    """Retrieve all 28 notification schedules."""
    schedules = db.query(NotificationSchedule).all()
    return [
        NotificationScheduleSchema(
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
        for s in schedules
    ]

@router.patch("/{schedule_id}", response_model=NotificationScheduleSchema)
def update_schedule(
    schedule_id: str,
    request: ScheduleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    """Update a specific schedule (Administrator access required)."""
    sched = db.query(NotificationSchedule).filter(NotificationSchedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found.")

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

    # Validate all schedules with this proposed update
    all_schedules = db.query(NotificationSchedule).all()
    val = validate_schedule_list(all_schedules)
    for err in val.errors:
        if err.schedule_id == sched.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.message)

    db.commit()
    db.refresh(sched)

    return NotificationScheduleSchema(
        id=sched.id,
        day_of_week=sched.day_of_week,
        meal_type=sched.meal_type,
        enabled=sched.enabled,
        notify_send_time=sched.notify_send_time,
        response_deadline_time=sched.response_deadline_time,
        meal_date_offset=sched.meal_date_offset,
        timezone=sched.timezone,
        overlap_acknowledged=sched.overlap_acknowledged,
    )

@router.get("/validate", response_model=ScheduleValidationResult)
@router.post("/validate", response_model=ScheduleValidationResult)
def validate_schedules(db: Session = Depends(get_db)):
    """Run validation checks across all active notification schedules."""
    all_schedules = db.query(NotificationSchedule).all()
    return validate_schedule_list(all_schedules)

@router.post("/acknowledge-overlap")
def acknowledge_overlap(
    request: AcknowledgeOverlapRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    """Explicitly acknowledge an intentional overlapping response window."""
    target_ids = []
    if request.schedule1_id:
        target_ids.append(request.schedule1_id)
    if request.schedule2_id:
        target_ids.append(request.schedule2_id)
    if request.schedule_id:
        target_ids.append(request.schedule_id)

    if not target_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Schedule ID(s) required.")

    schedules = db.query(NotificationSchedule).filter(NotificationSchedule.id.in_(target_ids)).all()
    if not schedules:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule(s) not found.")

    for s in schedules:
        s.overlap_acknowledged = bool(request.acknowledged)
    db.commit()

    return {
        "message": "Overlap acknowledged successfully.",
        "overlapAcknowledged": bool(request.acknowledged),
        "updatedCount": len(schedules),
    }
