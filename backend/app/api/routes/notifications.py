from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationSchema
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationSchema])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve notifications relevant to the authenticated user."""
    notifs = (
        db.query(Notification)
        .filter((Notification.user_id == current_user.id) | (Notification.user_id == None))
        .order_by(Notification.created_at.desc())
        .all()
    )
    return [
        NotificationSchema(
            id=n.id,
            title=n.title,
            message=n.message,
            created_at=n.created_at.isoformat(),
            is_read=n.is_read,
            meal_instance_id=n.meal_instance_id,
        )
        for n in notifs
    ]

@router.get("/unread-count", response_model=int)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the total count of unread notifications."""
    return (
        db.query(Notification)
        .filter(
            ((Notification.user_id == current_user.id) | (Notification.user_id == None)),
            Notification.is_read == False,
        )
        .count()
    )

@router.patch("/{notification_id}/read", response_model=NotificationSchema)
def mark_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a specific notification as read."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")

    notif.is_read = True
    db.commit()
    db.refresh(notif)

    return NotificationSchema(
        id=notif.id,
        title=notif.title,
        message=notif.message,
        created_at=notif.created_at.isoformat(),
        is_read=notif.is_read,
        meal_instance_id=notif.meal_instance_id,
    )

@router.post("/mark-all-read")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read."""
    db.query(Notification).filter(
        ((Notification.user_id == current_user.id) | (Notification.user_id == None)),
        Notification.is_read == False,
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read."}
