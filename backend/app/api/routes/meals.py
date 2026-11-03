from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.meal import MealInstanceSchema
from app.repositories.meal import IMealRepository
from app.dependencies.repositories import get_meal_repository

router = APIRouter(prefix="/meals", tags=["Meal Instances"])


@router.get("", response_model=List[MealInstanceSchema])
async def get_all_meals(meal_repo: IMealRepository = Depends(get_meal_repository)):
    """Retrieve all scheduled meal instances."""
    return await meal_repo.get_all()


@router.get("/today", response_model=List[MealInstanceSchema])
async def get_todays_meals(meal_repo: IMealRepository = Depends(get_meal_repository)):
    """Retrieve meal instances for today."""
    return await meal_repo.get_today()


@router.get("/actionable", response_model=Optional[MealInstanceSchema])
async def get_actionable_meal(meal_repo: IMealRepository = Depends(get_meal_repository)):
    """Retrieve the next upcoming meal requiring student intention."""
    return await meal_repo.get_actionable()


@router.get("/{meal_id}", response_model=MealInstanceSchema)
async def get_meal(
    meal_id: str,
    meal_repo: IMealRepository = Depends(get_meal_repository),
):
    """Retrieve details for a specific meal instance."""
    inst = await meal_repo.get_by_id(meal_id)
    if not inst:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")
    return inst
