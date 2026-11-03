from datetime import datetime, timezone, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.schemas.response import ResponseSubmitRequest, MealResponseSchema, MealCountsSchema
from app.schemas.user import UserOut
from app.dependencies.auth import get_current_user, require_role
from app.repositories.response import IResponseRepository
from app.repositories.meal import IMealRepository
from app.repositories.setting import ISettingsRepository
from app.repositories.schedule import IScheduleRepository
from app.dependencies.repositories import (
    get_response_repository,
    get_meal_repository,
    get_settings_repository,
    get_schedule_repository,
)
from app.core.timezone import get_institution_timezone, calculate_meal_response_window

router = APIRouter(prefix="/responses", tags=["Student Responses"])

ALLOWED_CHOICES = {"DEFINITELY_EATING", "PROBABLY_EATING", "NOT_EATING"}


@router.get("/my", response_model=Optional[MealResponseSchema])
async def get_my_response(
    meal_instance_id: Optional[str] = Query(None, alias="mealInstanceId"),
    meal_instance_id_alt: Optional[str] = Query(None, alias="meal_instance_id"),
    response_repo: IResponseRepository = Depends(get_response_repository),
    current_user: UserOut = Depends(get_current_user),
):
    """Retrieve the authenticated student's response for a specific meal."""
    target_id = meal_instance_id or meal_instance_id_alt
    if not target_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="mealInstanceId is required.")

    return await response_repo.get_by_student_and_meal(
        student_id=current_user.id,
        meal_instance_id=target_id,
    )


@router.post("", response_model=MealResponseSchema)
async def submit_response(
    request: ResponseSubmitRequest,
    meal_instance_id: Optional[str] = Query(None, alias="mealInstanceId"),
    meal_instance_id_alt: Optional[str] = Query(None, alias="meal_instance_id"),
    response_repo: IResponseRepository = Depends(get_response_repository),
    meal_repo: IMealRepository = Depends(get_meal_repository),
    settings_repo: ISettingsRepository = Depends(get_settings_repository),
    schedule_repo: IScheduleRepository = Depends(get_schedule_repository),
    current_user: UserOut = Depends(require_role("STUDENT")),
):
    """
    Submit or update meal attendance intention.
    Enforces server-side opening and closing window validation using the configured institution timezone.
    """
    target_id = request.meal_instance_id or meal_instance_id or meal_instance_id_alt
    if not target_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="mealInstanceId is required.")
    if request.choice not in ALLOWED_CHOICES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid choice '{request.choice}'. Allowed choices: {ALLOWED_CHOICES}",
        )

    if current_user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated or not eligible to submit meal responses.",
        )

    meal = await meal_repo.get_by_id(target_id)
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")

    # Server-side opening and closing window check using configured institutional timezone
    inst_setting = await settings_repo.get_settings()
    inst_tz = get_institution_timezone(inst_setting.timezone)
    now = datetime.now(timezone.utc)

    sched = None
    try:
        d = date.fromisoformat(meal.meal_date)
        weekday = d.strftime("%A").upper()
        sched = await schedule_repo.get_by_id(f"schedule-{weekday.lower()}-{meal.meal_type.lower()}")
    except Exception:
        pass

    try:
        open_utc, close_utc, open_iso, close_iso = calculate_meal_response_window(
            meal_date=meal.meal_date,
            meal_type=meal.meal_type,
            response_open_time=meal.response_open_time,
            response_deadline=meal.response_deadline,
            schedule=sched,
            tz=inst_tz,
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid meal deadline or window format.")

    if now < open_utc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The response window for this meal has not opened yet. Responses can only be submitted between {open_iso} and {close_iso}.",
        )

    if now >= close_utc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The deadline for this meal has passed. Responses can no longer be submitted or changed.",
        )

    return await response_repo.save_response(
        student_id=current_user.id,
        meal_instance_id=target_id,
        choice=request.choice,
    )


@router.get("/history", response_model=List[MealResponseSchema])
async def get_my_history(
    response_repo: IResponseRepository = Depends(get_response_repository),
    current_user: UserOut = Depends(require_role("STUDENT")),
):
    """
    Retrieve personal response history for the authenticated student.
    Strictly excludes responses from any other student (privacy rule).
    """
    return await response_repo.get_history_by_student(current_user.id)


@router.get("/counts/{meal_id}", response_model=MealCountsSchema)
async def get_aggregate_counts(
    meal_id: str,
    response_repo: IResponseRepository = Depends(get_response_repository),
    meal_repo: IMealRepository = Depends(get_meal_repository),
    current_user: UserOut = Depends(require_role("VENDOR", "ADMIN")),
):
    """
    Calculate aggregate response counts for a meal instance.
    CRITICAL BUSINESS RULE:
    No Response must remain a separate category. Never count it as Not Eating.
    """
    meal = await meal_repo.get_by_id(meal_id)
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")

    return await response_repo.get_counts_by_meal(meal_id)
