"""
MessMate System Settings & Institution Configuration Route
==========================================================
Manages persistent institution configuration, timezone, and forecasting safety margin.
"""

from fastapi import APIRouter, Depends, status
from app.schemas.setting import InstitutionSettingSchema, InstitutionSettingUpdate
from app.schemas.user import UserOut
from app.dependencies.auth import require_role
from app.repositories.setting import ISettingsRepository
from app.dependencies.repositories import get_settings_repository

router = APIRouter(prefix="/settings", tags=["System Settings"])


@router.get("", response_model=InstitutionSettingSchema)
async def get_settings(
    settings_repo: ISettingsRepository = Depends(get_settings_repository),
):
    """
    Retrieve current institutional configuration parameters.
    Returns persistent database values, initializing with defaults if not yet created.
    """
    return await settings_repo.get_settings()


@router.put("", response_model=InstitutionSettingSchema)
async def update_settings_put(
    update_data: InstitutionSettingUpdate,
    settings_repo: ISettingsRepository = Depends(get_settings_repository),
    current_user: UserOut = Depends(require_role("ADMIN")),
):
    """
    Update institutional configuration parameters (Administrator access required).
    Persists changes to the database and recalculates subsequent recommendations.
    """
    return await settings_repo.update_settings(update_data)


@router.patch("", response_model=InstitutionSettingSchema)
async def update_settings_patch(
    update_data: InstitutionSettingUpdate,
    settings_repo: ISettingsRepository = Depends(get_settings_repository),
    current_user: UserOut = Depends(require_role("ADMIN")),
):
    """
    Partial update for institutional configuration parameters (Administrator access required).
    """
    return await settings_repo.update_settings(update_data)
