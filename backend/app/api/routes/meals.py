from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.meal import MealInstance
from app.schemas.meal import MealInstanceSchema
from app.dependencies.auth import get_current_user, require_role

router = APIRouter(prefix="/meals", tags=["Meal Instances"])

def refresh_meal_statuses(instances: List[MealInstance], db: Session) -> List[MealInstance]:
    """Dynamically refresh meal statuses based on current server time vs deadline."""
    now = datetime.now(timezone.utc)
    changed = False

    for inst in instances:
        if inst.status == "COMPLETED":
            continue

        try:
            deadline = datetime.fromisoformat(inst.response_deadline)
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
        except Exception:
            continue

        # If past deadline, transition RESPONSE_OPEN -> RESPONSE_CLOSED
        if now > deadline and inst.status == "RESPONSE_OPEN":
            inst.status = "RESPONSE_CLOSED"
            changed = True
        elif now <= deadline and inst.status in ("UPCOMING", "RESPONSE_CLOSED"):
            # If not yet past deadline, mark open
            inst.status = "RESPONSE_OPEN"
            changed = True

    if changed:
        db.commit()

    return instances

@router.get("", response_model=List[MealInstanceSchema])
def get_all_meals(db: Session = Depends(get_db)):
    """Retrieve all scheduled meal instances."""
    instances = db.query(MealInstance).all()
    refreshed = refresh_meal_statuses(instances, db)
    return [
        MealInstanceSchema(
            id=i.id,
            meal_date=i.meal_date,
            meal_type=i.meal_type,
            menu_version_id=i.menu_version_id,
            response_deadline=i.response_deadline,
            status=i.status,
        )
        for i in refreshed
    ]

@router.get("/today", response_model=List[MealInstanceSchema])
def get_todays_meals(db: Session = Depends(get_db)):
    """Retrieve meal instances for today."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    instances = db.query(MealInstance).filter(MealInstance.meal_date == today_str).all()
    refreshed = refresh_meal_statuses(instances, db)
    return [
        MealInstanceSchema(
            id=i.id,
            meal_date=i.meal_date,
            meal_type=i.meal_type,
            menu_version_id=i.menu_version_id,
            response_deadline=i.response_deadline,
            status=i.status,
        )
        for i in refreshed
    ]

@router.get("/actionable", response_model=Optional[MealInstanceSchema])
def get_actionable_meal(db: Session = Depends(get_db)):
    """Retrieve the next upcoming meal requiring student intention."""
    instances = db.query(MealInstance).all()
    refreshed = refresh_meal_statuses(instances, db)

    # 1. Prefer RESPONSE_OPEN
    open_meals = [i for i in refreshed if i.status == "RESPONSE_OPEN"]
    if open_meals:
        open_meals.sort(key=lambda x: x.response_deadline)
        target = open_meals[0]
        return MealInstanceSchema(
            id=target.id,
            meal_date=target.meal_date,
            meal_type=target.meal_type,
            menu_version_id=target.menu_version_id,
            response_deadline=target.response_deadline,
            status=target.status,
        )

    # 2. Or earliest UPCOMING
    upcoming = [i for i in refreshed if i.status == "UPCOMING"]
    if upcoming:
        upcoming.sort(key=lambda x: x.meal_date)
        target = upcoming[0]
        return MealInstanceSchema(
            id=target.id,
            meal_date=target.meal_date,
            meal_type=target.meal_type,
            menu_version_id=target.menu_version_id,
            response_deadline=target.response_deadline,
            status=target.status,
        )

    return None

@router.get("/{meal_id}", response_model=MealInstanceSchema)
def get_meal(meal_id: str, db: Session = Depends(get_db)):
    """Retrieve details for a specific meal instance."""
    inst = db.query(MealInstance).filter(MealInstance.id == meal_id).first()
    if not inst:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal instance not found.")
    refreshed = refresh_meal_statuses([inst], db)[0]
    return MealInstanceSchema(
        id=refreshed.id,
        meal_date=refreshed.meal_date,
        meal_type=refreshed.meal_type,
        menu_version_id=refreshed.menu_version_id,
        response_deadline=refreshed.response_deadline,
        status=refreshed.status,
    )
