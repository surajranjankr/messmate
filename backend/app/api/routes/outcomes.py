from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.outcome import MealOutcomeSchema, MealOutcomeCreateRequest
from app.schemas.user import UserOut
from app.dependencies.auth import require_role
from app.repositories.outcome import IOutcomeRepository
from app.repositories.meal import IMealRepository
from app.dependencies.repositories import get_outcome_repository, get_meal_repository

router = APIRouter(prefix="/outcomes", tags=["Meal Outcomes"])


@router.get("", response_model=List[MealOutcomeSchema])
async def get_all_outcomes(outcome_repo: IOutcomeRepository = Depends(get_outcome_repository)):
    """Retrieve all recorded post-meal outcome entries."""
    return await outcome_repo.get_all()


@router.get("/{meal_id}", response_model=Optional[MealOutcomeSchema])
async def get_outcome(
    meal_id: str,
    outcome_repo: IOutcomeRepository = Depends(get_outcome_repository),
):
    """Retrieve outcome for a specific meal instance."""
    return await outcome_repo.get_by_meal(meal_id)


@router.post("/{meal_id}", response_model=MealOutcomeSchema)
async def save_outcome(
    meal_id: str,
    request: MealOutcomeCreateRequest,
    outcome_repo: IOutcomeRepository = Depends(get_outcome_repository),
    meal_repo: IMealRepository = Depends(get_meal_repository),
    current_user: UserOut = Depends(require_role("VENDOR", "ADMIN")),
):
    """
    Record or update post-meal outcome measurements.
    Maintains explicit units: headcount in students, batches in portions, leftovers in kg.
    """
    meal = await meal_repo.get_by_id(meal_id)
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")

    if request.actual_attendance is not None and request.actual_attendance < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Actual attendance cannot be negative.")

    if request.actual_prepared_quantity is not None and request.actual_prepared_quantity < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Actual prepared quantity cannot be negative.")

    if request.leftover_quantity is not None and request.leftover_quantity < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Leftover quantity cannot be negative.")

    return await outcome_repo.save_outcome(meal_id, request)
