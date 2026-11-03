from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.schedule import (
    NotificationScheduleSchema,
    ScheduleUpdateRequest,
    ScheduleValidationResult,
    AcknowledgeOverlapRequest,
)
from app.schemas.user import UserOut
from app.dependencies.auth import require_role
from app.repositories.schedule import IScheduleRepository
from app.dependencies.repositories import get_schedule_repository

router = APIRouter(prefix="/schedules", tags=["Notification Schedules"])


@router.get("", response_model=List[NotificationScheduleSchema])
async def get_schedules(schedule_repo: IScheduleRepository = Depends(get_schedule_repository)):
    """Retrieve all 28 notification schedules."""
    return await schedule_repo.get_all()


@router.patch("/{schedule_id}", response_model=NotificationScheduleSchema)
async def update_schedule(
    schedule_id: str,
    request: ScheduleUpdateRequest,
    schedule_repo: IScheduleRepository = Depends(get_schedule_repository),
    current_user: UserOut = Depends(require_role("ADMIN")),
):
    """Update a specific schedule (Administrator access required)."""
    try:
        return await schedule_repo.update(schedule_id, request)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/validate", response_model=ScheduleValidationResult)
@router.post("/validate", response_model=ScheduleValidationResult)
async def validate_schedules(schedule_repo: IScheduleRepository = Depends(get_schedule_repository)):
    """Run validation checks across all active notification schedules."""
    return await schedule_repo.validate()


@router.post("/acknowledge-overlap")
async def acknowledge_overlap(
    request: AcknowledgeOverlapRequest,
    schedule_repo: IScheduleRepository = Depends(get_schedule_repository),
    current_user: UserOut = Depends(require_role("ADMIN")),
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

    count = await schedule_repo.acknowledge_overlap(target_ids, bool(request.acknowledged))
    if count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule(s) not found.")

    return {
        "message": "Overlap acknowledged successfully.",
        "overlapAcknowledged": bool(request.acknowledged),
        "updatedCount": count,
    }
