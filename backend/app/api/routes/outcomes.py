from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.meal import MealInstance
from app.models.outcome import MealOutcome
from app.models.user import User
from app.schemas.outcome import MealOutcomeSchema, MealOutcomeCreateRequest
from app.dependencies.auth import get_current_user, require_role

router = APIRouter(prefix="/outcomes", tags=["Meal Outcomes"])

@router.get("", response_model=List[MealOutcomeSchema])
def get_all_outcomes(db: Session = Depends(get_db)):
    """Retrieve all recorded post-meal outcome entries."""
    outcomes = db.query(MealOutcome).order_by(MealOutcome.recorded_at.desc()).all()
    return [
        MealOutcomeSchema(
            meal_instance_id=o.meal_instance_id,
            actual_attendance=o.actual_attendance,
            actual_prepared_quantity=o.actual_prepared_quantity,
            prepared_unit=o.prepared_unit,
            leftover_quantity=o.leftover_quantity,
            leftover_unit=o.leftover_unit,
            notes=o.notes,
            recorded_at=o.recorded_at.isoformat(),
        )
        for o in outcomes
    ]

@router.get("/{meal_id}", response_model=Optional[MealOutcomeSchema])
def get_outcome(meal_id: str, db: Session = Depends(get_db)):
    """Retrieve outcome for a specific meal instance."""
    outcome = db.query(MealOutcome).filter(MealOutcome.meal_instance_id == meal_id).first()
    if not outcome:
        return None
    return MealOutcomeSchema(
        meal_instance_id=outcome.meal_instance_id,
        actual_attendance=outcome.actual_attendance,
        actual_prepared_quantity=outcome.actual_prepared_quantity,
        prepared_unit=outcome.prepared_unit,
        leftover_quantity=outcome.leftover_quantity,
        leftover_unit=outcome.leftover_unit,
        notes=outcome.notes,
        recorded_at=outcome.recorded_at.isoformat(),
    )

@router.post("/{meal_id}", response_model=MealOutcomeSchema)
def save_outcome(
    meal_id: str,
    request: MealOutcomeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR", "ADMIN")),
):
    """
    Record or update post-meal outcome measurements.
    Maintains explicit units: headcount in students, batches in portions, leftovers in kg.
    """
    meal = db.query(MealInstance).filter(MealInstance.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")

    if request.actual_attendance is not None and request.actual_attendance < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Actual attendance cannot be negative.")

    if request.actual_prepared_quantity is not None and request.actual_prepared_quantity < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Actual prepared quantity cannot be negative.")

    if request.leftover_quantity is not None and request.leftover_quantity < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Leftover quantity cannot be negative.")

    outcome = db.query(MealOutcome).filter(MealOutcome.meal_instance_id == meal_id).first()
    now = datetime.now(timezone.utc)

    if outcome:
        outcome.actual_attendance = request.actual_attendance
        outcome.actual_prepared_quantity = request.actual_prepared_quantity
        outcome.prepared_unit = request.prepared_unit or "portions"
        outcome.leftover_quantity = request.leftover_quantity
        outcome.leftover_unit = request.leftover_unit if request.leftover_quantity is not None else None
        outcome.notes = request.notes.strip() if request.notes else None
        outcome.recorded_at = now
    else:
        outcome = MealOutcome(
            meal_instance_id=meal_id,
            actual_attendance=request.actual_attendance,
            actual_prepared_quantity=request.actual_prepared_quantity,
            prepared_unit=request.prepared_unit or "portions",
            leftover_quantity=request.leftover_quantity,
            leftover_unit=request.leftover_unit if request.leftover_quantity is not None else None,
            notes=request.notes.strip() if request.notes else None,
            recorded_at=now,
        )
        db.add(outcome)

    db.commit()
    db.refresh(outcome)

    return MealOutcomeSchema(
        meal_instance_id=outcome.meal_instance_id,
        actual_attendance=outcome.actual_attendance,
        actual_prepared_quantity=outcome.actual_prepared_quantity,
        prepared_unit=outcome.prepared_unit,
        leftover_quantity=outcome.leftover_quantity,
        leftover_unit=outcome.leftover_unit,
        notes=outcome.notes,
        recorded_at=outcome.recorded_at.isoformat(),
    )
