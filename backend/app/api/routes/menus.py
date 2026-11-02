import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.menu import MenuVersion, MenuMealEntry, DishItem
from app.models.user import User
from app.schemas.menu import (
    MenuVersionSchema,
    MenuMealEntrySchema,
    DishItemSchema,
    DraftSaveRequest,
    PublishRequest,
)
from app.dependencies.auth import get_current_user, require_role

router = APIRouter(prefix="/menus", tags=["Menus"])

def serialize_menu_version(version: MenuVersion) -> MenuVersionSchema:
    """Helper to convert SQLAlchemy MenuVersion model to Pydantic schema."""
    meals = []
    for m in version.meals:
        dishes = [
            DishItemSchema(
                id=d.id,
                name=d.name,
                alternatives=d.alternatives or [],
                category=d.category,
            )
            for d in m.dishes
        ]
        meals.append(
            MenuMealEntrySchema(
                id=m.id,
                day_of_week=m.day_of_week,
                meal_type=m.meal_type,
                dishes=dishes,
                accompaniments=m.accompaniments or [],
                notes=m.notes or [],
            )
        )
    return MenuVersionSchema(
        id=version.id,
        version_number=version.version_number,
        status=version.status,
        meals=meals,
        created_at=version.created_at.isoformat() if version.created_at else "",
        published_at=version.published_at.isoformat() if version.published_at else None,
        change_summary=version.change_summary,
    )

@router.get("/published", response_model=MenuVersionSchema)
def get_published_menu(db: Session = Depends(get_db)):
    """Retrieve the currently active published menu version."""
    version = (
        db.query(MenuVersion)
        .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
        .filter(MenuVersion.status == "PUBLISHED")
        .first()
    )
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No published menu version found.",
        )
    return serialize_menu_version(version)

@router.get("/draft", response_model=MenuVersionSchema)
def get_draft_menu(db: Session = Depends(get_db)):
    """Retrieve the current menu draft, if one exists."""
    version = (
        db.query(MenuVersion)
        .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
        .filter(MenuVersion.status == "DRAFT")
        .first()
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active draft menu found.")
    return serialize_menu_version(version)

@router.post("/draft", response_model=MenuVersionSchema)
def save_draft_menu(
    request: DraftSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    """Create or update a menu draft without affecting published versions."""
    draft = db.query(MenuVersion).filter(MenuVersion.status == "DRAFT").first()
    published = db.query(MenuVersion).filter(MenuVersion.status == "PUBLISHED").first()

    next_version = (published.version_number + 1) if published else 1

    if not draft:
        draft = MenuVersion(
            id=f"menu-draft-{uuid.uuid4().hex[:8]}",
            version_number=next_version,
            status="DRAFT",
            change_summary=request.change_summary or "Work in progress",
            created_at=datetime.now(timezone.utc),
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)

        # If no meals provided in creation request, clone from current published version
        if not request.meals and published:
            for p_meal in published.meals:
                entry_id = f"entry-{draft.id}-{p_meal.day_of_week.lower()}-{p_meal.meal_type.lower()}"
                entry = MenuMealEntry(
                    id=entry_id,
                    menu_version_id=draft.id,
                    day_of_week=p_meal.day_of_week,
                    meal_type=p_meal.meal_type,
                    accompaniments=p_meal.accompaniments,
                    notes=p_meal.notes,
                )
                db.add(entry)
                db.commit()
                for p_dish in p_meal.dishes:
                    dish = DishItem(
                        id=f"dish-{uuid.uuid4().hex[:8]}",
                        menu_meal_entry_id=entry_id,
                        name=p_dish.name,
                        alternatives=p_dish.alternatives,
                        category=p_dish.category,
                    )
                    db.add(dish)
                db.commit()
    else:
        # Clear existing entries in draft to replace with incoming
        db.query(MenuMealEntry).filter(MenuMealEntry.menu_version_id == draft.id).delete()
        draft.change_summary = request.change_summary or draft.change_summary
        db.commit()

    if request.meals:
        # Re-insert meal entries and dishes
        for meal_schema in request.meals:
            entry_id = f"entry-{draft.id}-{meal_schema.day_of_week.lower()}-{meal_schema.meal_type.lower()}"
            entry = MenuMealEntry(
                id=entry_id,
                menu_version_id=draft.id,
                day_of_week=meal_schema.day_of_week,
                meal_type=meal_schema.meal_type,
                accompaniments=meal_schema.accompaniments,
                notes=meal_schema.notes,
            )
            db.add(entry)
            db.commit()

            for d_schema in meal_schema.dishes:
                dish = DishItem(
                    id=d_schema.id if d_schema.id else f"dish-{uuid.uuid4().hex[:8]}",
                    menu_meal_entry_id=entry_id,
                    name=d_schema.name,
                    alternatives=d_schema.alternatives,
                    category=d_schema.category,
                )
                db.add(dish)
            db.commit()

    refreshed_draft = (
        db.query(MenuVersion)
        .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
        .filter(MenuVersion.id == draft.id)
        .first()
    )
    return serialize_menu_version(refreshed_draft)

@router.delete("/draft", status_code=status.HTTP_204_NO_CONTENT)
def discard_draft_menu(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    """Discard the current un-published draft."""
    draft = db.query(MenuVersion).filter(MenuVersion.status == "DRAFT").first()
    if draft:
        db.delete(draft)
        db.commit()
    return None

@router.post("/publish", response_model=MenuVersionSchema)
def publish_draft_menu(
    request: PublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    """Publish the current draft as a new immutable version, archiving previous published."""
    draft = db.query(MenuVersion).filter(MenuVersion.status == "DRAFT").first()
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No draft menu exists to publish.",
        )

    current_published = db.query(MenuVersion).filter(MenuVersion.status == "PUBLISHED").first()
    next_ver_num = (current_published.version_number + 1) if current_published else 1

    # Archive previous published version
    if current_published:
        current_published.status = "ARCHIVED"

    # Promote draft to published
    draft.status = "PUBLISHED"
    draft.version_number = next_ver_num
    draft.published_at = datetime.now(timezone.utc)
    draft.change_summary = request.change_summary or "Published menu version update"

    db.commit()

    published_version = (
        db.query(MenuVersion)
        .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
        .filter(MenuVersion.id == draft.id)
        .first()
    )
    return serialize_menu_version(published_version)

@router.get("/history", response_model=List[MenuVersionSchema])
def get_version_history(db: Session = Depends(get_db)):
    """Retrieve all menu versions ordered latest first."""
    versions = (
        db.query(MenuVersion)
        .options(joinedload(MenuVersion.meals).joinedload(MenuMealEntry.dishes))
        .order_by(MenuVersion.version_number.desc())
        .all()
    )
    return [serialize_menu_version(v) for v in versions]

@router.get("/meal", response_model=Optional[MenuMealEntrySchema])
def get_meal_menu(
    day_of_week: Optional[str] = Query(None, alias="dayOfWeek"),
    day_alt: Optional[str] = Query(None, alias="day"),
    meal_type: Optional[str] = Query(None, alias="mealType"),
    meal_alt: Optional[str] = Query(None, alias="meal"),
    version_id: Optional[str] = Query(None, alias="versionId"),
    db: Session = Depends(get_db),
):
    """Retrieve menu entry for a specific day and meal slot."""
    target_day = day_of_week or day_alt
    target_meal = meal_type or meal_alt
    if not target_day or not target_meal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="day and meal are required query parameters.",
        )

    query = (
        db.query(MenuMealEntry)
        .options(joinedload(MenuMealEntry.dishes))
        .filter(
            MenuMealEntry.day_of_week == target_day.upper(),
            MenuMealEntry.meal_type == target_meal.upper(),
        )
    )

    if version_id:
        query = query.filter(MenuMealEntry.menu_version_id == version_id)
    else:
        # Default to published version
        published = db.query(MenuVersion).filter(MenuVersion.status == "PUBLISHED").first()
        if not published:
            return None
        query = query.filter(MenuMealEntry.menu_version_id == published.id)

    entry = query.first()
    if not entry:
        return None

    dishes = [
        DishItemSchema(
            id=d.id,
            name=d.name,
            alternatives=d.alternatives or [],
            category=d.category,
        )
        for d in entry.dishes
    ]
    return MenuMealEntrySchema(
        id=entry.id,
        day_of_week=entry.day_of_week,
        meal_type=entry.meal_type,
        dishes=dishes,
        accompaniments=entry.accompaniments or [],
        notes=entry.notes or [],
    )
