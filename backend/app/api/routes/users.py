from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.user import UserOut, UserCreate, UserUpdate
from app.dependencies.auth import require_role
from app.repositories.user import IUserRepository
from app.dependencies.repositories import get_user_repository

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserOut])
async def list_users(
    user_repo: IUserRepository = Depends(get_user_repository),
    current_user: UserOut = Depends(require_role("ADMIN"))
):
    """List all registered users (Administrator access required)."""
    return await user_repo.list_users()

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreate,
    user_repo: IUserRepository = Depends(get_user_repository),
    current_user: UserOut = Depends(require_role("ADMIN"))
):
    """Add a new user (Administrator access required)."""
    return await user_repo.create_user(request)

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    request: UserUpdate,
    user_repo: IUserRepository = Depends(get_user_repository),
    current_user: UserOut = Depends(require_role("ADMIN"))
):
    """Update user details (Administrator access required)."""
    user = await user_repo.update_user(user_id, request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    return user

@router.patch("/{user_id}/status", response_model=UserOut)
async def toggle_user_status(
    user_id: str,
    user_repo: IUserRepository = Depends(get_user_repository),
    current_user: UserOut = Depends(require_role("ADMIN"))
):
    """Toggle user active / inactive status (Administrator access required)."""
    user = await user_repo.toggle_status(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    user_repo: IUserRepository = Depends(get_user_repository),
    current_user: UserOut = Depends(require_role("ADMIN"))
):
    """Permanently delete a user (Administrator access required). Cannot delete oneself."""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own active account."
        )
    success = await user_repo.delete_user(user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    return None
