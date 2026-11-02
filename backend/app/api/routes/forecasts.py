import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.meal import MealInstance
from app.models.forecast import ForecastRecommendation, VendorDecision
from app.models.user import User
from app.schemas.forecast import (
    ForecastRecommendationSchema,
    VendorDecisionSchema,
    VendorDecisionCreateRequest,
)
from app.dependencies.auth import get_current_user, require_role
from app.core.config import settings

router = APIRouter(prefix="/forecasts", tags=["Forecasting & Vendor Decisions"])

@router.get("/recommendation/{meal_id}", response_model=ForecastRecommendationSchema)
def get_recommendation(meal_id: str, db: Session = Depends(get_db)):
    """Retrieve or compute preparation recommendation for a meal instance."""
    meal = db.query(MealInstance).filter(MealInstance.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")

    rec = db.query(ForecastRecommendation).filter(ForecastRecommendation.meal_instance_id == meal_id).first()
    if not rec:
        B = settings.DEFAULT_BASELINE_ATTENDANCE
        m = settings.DEFAULT_SAFETY_MARGIN
        F = B
        Q = math.ceil(F * (1 + m))

        rec = ForecastRecommendation(
            meal_instance_id=meal_id,
            baseline_attendance=B,
            expected_attendance=F,
            safety_margin_fraction=m,
            recommended_portions=Q,
            forecast_method="BASELINE_ONLY",
            data_quality_status="DEMONSTRATION",
            explanation=f"DEMONSTRATION ESTIMATE: Baseline attendance of {B} students plus a provisional {int(m * 100)}% safety margin yields {Q} recommended portions. F=B={B}, Q=ceil({B}*(1+{m}))={Q}.",
            created_at=datetime.now(timezone.utc),
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

    return ForecastRecommendationSchema(
        meal_instance_id=rec.meal_instance_id,
        baseline_attendance=rec.baseline_attendance,
        expected_attendance=rec.expected_attendance,
        safety_margin_fraction=rec.safety_margin_fraction,
        recommended_portions=rec.recommended_portions,
        forecast_method=rec.forecast_method,
        data_quality_status=rec.data_quality_status,
        explanation=rec.explanation,
    )

@router.get("/decision/{meal_id}", response_model=Optional[VendorDecisionSchema])
def get_vendor_decision(meal_id: str, db: Session = Depends(get_db)):
    """Retrieve the vendor's confirmed batch plan for a meal instance."""
    decision = db.query(VendorDecision).filter(VendorDecision.meal_instance_id == meal_id).first()
    if not decision:
        return None
    return VendorDecisionSchema(
        meal_instance_id=decision.meal_instance_id,
        original_recommendation=decision.original_recommendation,
        final_planned_quantity=decision.final_planned_quantity,
        override_reason=decision.override_reason,
        status=decision.status,
        updated_at=decision.updated_at.isoformat(),
    )

@router.post("/decision/{meal_id}", response_model=VendorDecisionSchema)
def save_vendor_decision(
    meal_id: str,
    request: VendorDecisionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR", "ADMIN")),
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

    # Ensure recommendation exists to preserve original recommendation
    rec = get_recommendation(meal_id, db)
    is_override = (request.final_planned_quantity != rec.recommended_portions)

    decision = db.query(VendorDecision).filter(VendorDecision.meal_instance_id == meal_id).first()
    now = datetime.now(timezone.utc)

    if decision:
        decision.final_planned_quantity = request.final_planned_quantity
        decision.override_reason = request.override_reason if is_override else None
        decision.status = "OVERRIDDEN" if is_override else "ACCEPTED"
        decision.updated_at = now
    else:
        decision = VendorDecision(
            meal_instance_id=meal_id,
            original_recommendation=rec.recommended_portions,
            final_planned_quantity=request.final_planned_quantity,
            override_reason=request.override_reason if is_override else None,
            status="OVERRIDDEN" if is_override else "ACCEPTED",
            updated_at=now,
        )
        db.add(decision)

    db.commit()
    db.refresh(decision)

    return VendorDecisionSchema(
        meal_instance_id=decision.meal_instance_id,
        original_recommendation=decision.original_recommendation,
        final_planned_quantity=decision.final_planned_quantity,
        override_reason=decision.override_reason,
        status=decision.status,
        updated_at=decision.updated_at.isoformat(),
    )
