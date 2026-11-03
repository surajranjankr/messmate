from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.notification import NotificationSchema
from app.schemas.user import UserOut
from app.dependencies.auth import get_current_user
from app.repositories.notification import INotificationRepository
from app.dependencies.repositories import get_notification_repository

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationSchema])
async def get_notifications(
    notification_repo: INotificationRepository = Depends(get_notification_repository),
    current_user: UserOut = Depends(get_current_user),
):
    """Retrieve notifications relevant to the authenticated user."""
    return await notification_repo.get_for_user(current_user.id)


@router.get("/unread-count", response_model=int)
async def get_unread_count(
    notification_repo: INotificationRepository = Depends(get_notification_repository),
    current_user: UserOut = Depends(get_current_user),
):
    """Get the total count of unread notifications."""
    return await notification_repo.get_unread_count(current_user.id)


@router.patch("/{notification_id}/read", response_model=NotificationSchema)
async def mark_as_read(
    notification_id: str,
    notification_repo: INotificationRepository = Depends(get_notification_repository),
    current_user: UserOut = Depends(get_current_user),
):
    """Mark a specific notification as read."""
    notif = await notification_repo.mark_as_read(notification_id, current_user.id)
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    return notif


@router.post("/mark-all-read")
async def mark_all_as_read(
    notification_repo: INotificationRepository = Depends(get_notification_repository),
    current_user: UserOut = Depends(get_current_user),
):
    """Mark all notifications as read."""
    await notification_repo.mark_all_as_read(current_user.id)
    return {"message": "All notifications marked as read."}
