from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.schemas.menu import (
    MenuVersionSchema,
    MenuMealEntrySchema,
    DraftSaveRequest,
    PublishRequest,
)
from app.schemas.user import UserOut
from app.dependencies.auth import require_role
from app.repositories.menu import IMenuRepository
from app.dependencies.repositories import get_menu_repository

router = APIRouter(prefix="/menus", tags=["Menus"])


@router.get("/published", response_model=MenuVersionSchema)
async def get_published_menu(menu_repo: IMenuRepository = Depends(get_menu_repository)):
    """Retrieve the currently active published menu version."""
    version = await menu_repo.get_published()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No published menu version found.",
        )
    return version


@router.get("/draft", response_model=MenuVersionSchema)
async def get_draft_menu(menu_repo: IMenuRepository = Depends(get_menu_repository)):
    """Retrieve the current menu draft, if one exists."""
    version = await menu_repo.get_draft()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active draft menu found.")
    return version


@router.post("/draft", response_model=MenuVersionSchema)
async def save_draft_menu(
    request: DraftSaveRequest,
    menu_repo: IMenuRepository = Depends(get_menu_repository),
    current_user: UserOut = Depends(require_role("ADMIN")),
):
    """Create or update a menu draft without affecting published versions."""
    return await menu_repo.save_draft(request)


@router.delete("/draft", status_code=status.HTTP_204_NO_CONTENT)
async def discard_draft_menu(
    menu_repo: IMenuRepository = Depends(get_menu_repository),
    current_user: UserOut = Depends(require_role("ADMIN")),
):
    """Discard the current un-published draft."""
    await menu_repo.discard_draft()
    return None


@router.post("/publish", response_model=MenuVersionSchema)
async def publish_draft_menu(
    request: PublishRequest,
    menu_repo: IMenuRepository = Depends(get_menu_repository),
    current_user: UserOut = Depends(require_role("ADMIN")),
):
    """Publish the current draft as a new immutable version, archiving previous published."""
    try:
        return await menu_repo.publish_draft(request)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get("/history", response_model=List[MenuVersionSchema])
async def get_version_history(menu_repo: IMenuRepository = Depends(get_menu_repository)):
    """Retrieve all menu versions ordered latest first."""
    return await menu_repo.get_history()


@router.get("/meal", response_model=Optional[MenuMealEntrySchema])
async def get_meal_menu(
    day_of_week: Optional[str] = Query(None, alias="dayOfWeek"),
    day_alt: Optional[str] = Query(None, alias="day"),
    meal_type: Optional[str] = Query(None, alias="mealType"),
    meal_alt: Optional[str] = Query(None, alias="meal"),
    version_id: Optional[str] = Query(None, alias="versionId"),
    menu_repo: IMenuRepository = Depends(get_menu_repository),
):
    """Retrieve menu entry for a specific day and meal slot."""
    target_day = day_of_week or day_alt
    target_meal = meal_type or meal_alt
    if not target_day or not target_meal:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="day and meal are required query parameters.",
        )

    return await menu_repo.get_meal_entry(
        day_of_week=target_day,
        meal_type=target_meal,
        version_id=version_id,
    )
