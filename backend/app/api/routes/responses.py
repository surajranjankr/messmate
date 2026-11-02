import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.meal import MealInstance
from app.models.response import MealResponse
from app.models.user import User
from app.schemas.response import ResponseSubmitRequest, MealResponseSchema, MealCountsSchema
from app.dependencies.auth import get_current_user, require_role
from app.core.config import settings

router = APIRouter(prefix="/responses", tags=["Student Responses"])

ALLOWED_CHOICES = {"DEFINITELY_EATING", "PROBABLY_EATING", "NOT_EATING"}

@router.get("/my", response_model=Optional[MealResponseSchema])
def get_my_response(
    meal_instance_id: Optional[str] = Query(None, alias="mealInstanceId"),
    meal_instance_id_alt: Optional[str] = Query(None, alias="meal_instance_id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the authenticated student's response for a specific meal."""
    target_id = meal_instance_id or meal_instance_id_alt
    if not target_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="mealInstanceId is required.")

    resp = (
        db.query(MealResponse)
        .filter(
            MealResponse.student_id == current_user.id,
            MealResponse.meal_instance_id == target_id,
        )
        .first()
    )
    if not resp:
        return None
    return MealResponseSchema(
        id=resp.id,
        student_id=resp.student_id,
        meal_instance_id=resp.meal_instance_id,
        choice=resp.choice,
        created_at=resp.created_at.isoformat(),
        updated_at=resp.updated_at.isoformat(),
    )

@router.post("", response_model=MealResponseSchema)
def submit_response(
    request: ResponseSubmitRequest,
    meal_instance_id: Optional[str] = Query(None, alias="mealInstanceId"),
    meal_instance_id_alt: Optional[str] = Query(None, alias="meal_instance_id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("STUDENT")),
):
    """
    Submit or update meal attendance intention.
    Enforces server-side deadline validation.
    """
    target_id = request.meal_instance_id or meal_instance_id or meal_instance_id_alt
    if not target_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="mealInstanceId is required.")
    if request.choice not in ALLOWED_CHOICES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid choice '{request.choice}'. Allowed choices: {ALLOWED_CHOICES}",
        )

    meal = db.query(MealInstance).filter(MealInstance.id == target_id).first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")

    # Server-side deadline check
    now = datetime.now(timezone.utc)
    try:
        deadline = datetime.fromisoformat(meal.response_deadline)
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid meal deadline format.")

    if now > deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The deadline for this meal has passed. Responses can no longer be submitted or changed.",
        )

    # Check if an existing response exists for this student on this meal
    existing = (
        db.query(MealResponse)
        .filter(
            MealResponse.student_id == current_user.id,
            MealResponse.meal_instance_id == target_id,
        )
        .first()
    )

    if existing:
        existing.choice = request.choice
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        target = existing
    else:
        new_resp = MealResponse(
            id=f"resp-{uuid.uuid4().hex[:8]}",
            student_id=current_user.id,
            meal_instance_id=target_id,
            choice=request.choice,
            created_at=now,
            updated_at=now,
        )
        db.add(new_resp)
        db.commit()
        db.refresh(new_resp)
        target = new_resp

    return MealResponseSchema(
        id=target.id,
        student_id=target.student_id,
        meal_instance_id=target.meal_instance_id,
        choice=target.choice,
        created_at=target.created_at.isoformat(),
        updated_at=target.updated_at.isoformat(),
    )

@router.get("/history", response_model=List[MealResponseSchema])
def get_my_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("STUDENT")),
):
    """
    Retrieve personal response history for the authenticated student.
    Strictly excludes responses from any other student (privacy rule).
    """
    responses = (
        db.query(MealResponse)
        .filter(MealResponse.student_id == current_user.id)
        .order_by(MealResponse.created_at.desc())
        .all()
    )
    return [
        MealResponseSchema(
            id=r.id,
            student_id=r.student_id,
            meal_instance_id=r.meal_instance_id,
            choice=r.choice,
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
        )
        for r in responses
    ]

@router.get("/counts/{meal_id}", response_model=MealCountsSchema)
def get_aggregate_counts(
    meal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR", "ADMIN")),
):
    """
    Calculate aggregate response counts for a meal instance.
    CRITICAL BUSINESS RULE:
    No Response must remain a separate category. Never count it as Not Eating.
    """
    meal = db.query(MealInstance).filter(MealInstance.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")

    responses = db.query(MealResponse).filter(MealResponse.meal_instance_id == meal_id).all()

    definitely = sum(1 for r in responses if r.choice == "DEFINITELY_EATING")
    probably = sum(1 for r in responses if r.choice == "PROBABLY_EATING")
    not_eating = sum(1 for r in responses if r.choice == "NOT_EATING")

    total_responded = definitely + probably + not_eating
    total_registered = settings.TOTAL_REGISTERED_STUDENTS
    no_response = max(0, total_registered - total_responded)

    return MealCountsSchema(
        definitely_eating=definitely,
        probably_eating=probably,
        not_eating=not_eating,
        no_response=no_response,
        total_registered=total_registered,
    )
