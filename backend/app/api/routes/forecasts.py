from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.forecast import (
    ForecastRecommendationSchema,
    VendorDecisionSchema,
    VendorDecisionCreateRequest,
)
from app.schemas.user import UserOut
from app.dependencies.auth import require_role
from app.repositories.forecast import IForecastRepository
from app.repositories.meal import IMealRepository
from app.dependencies.repositories import get_forecast_repository, get_meal_repository

router = APIRouter(prefix="/forecasts", tags=["Forecasting & Vendor Decisions"])


@router.get("/recommendation/{meal_id}", response_model=ForecastRecommendationSchema)
async def get_recommendation(
    meal_id: str,
    forecast_repo: IForecastRepository = Depends(get_forecast_repository),
    meal_repo: IMealRepository = Depends(get_meal_repository),
):
    """Retrieve or compute preparation recommendation for a meal instance."""
    meal = await meal_repo.get_by_id(meal_id)
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")

    return await forecast_repo.get_recommendation(meal_id)


@router.get("/decision/{meal_id}", response_model=Optional[VendorDecisionSchema])
async def get_vendor_decision(
    meal_id: str,
    forecast_repo: IForecastRepository = Depends(get_forecast_repository),
):
    """Retrieve the vendor's confirmed batch plan for a meal instance."""
    return await forecast_repo.get_decision(meal_id)


@router.post("/decision/{meal_id}", response_model=VendorDecisionSchema)
async def save_vendor_decision(
    meal_id: str,
    request: VendorDecisionCreateRequest,
    forecast_repo: IForecastRepository = Depends(get_forecast_repository),
    meal_repo: IMealRepository = Depends(get_meal_repository),
    current_user: UserOut = Depends(require_role("VENDOR", "ADMIN")),
):
    """
    Save or update vendor's planned preparation quantity.
    Enforces non-negative whole number and preserves original recommendation.
    """
    if request.final_planned_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Planned preparation quantity must be a non-negative whole number.",
        )

    meal = await meal_repo.get_by_id(meal_id)
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")

    return await forecast_repo.save_decision(
        meal_id=meal_id,
        planned_quantity=request.final_planned_quantity,
        override_reason=request.override_reason,
    )
