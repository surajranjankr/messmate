"""
MessMate SQLite Notification Repository Implementation
======================================================
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.schemas.notification import NotificationSchema
from app.repositories.notification import INotificationRepository


class SqliteNotificationRepository(INotificationRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_schema(self, n: Notification) -> NotificationSchema:
        return NotificationSchema(
            id=n.id,
            title=n.title,
            message=n.message,
            created_at=n.created_at.isoformat() if hasattr(n.created_at, "isoformat") else str(n.created_at),
            is_read=n.is_read,
            meal_instance_id=n.meal_instance_id,
        )

    async def get_for_user(self, user_id: str) -> List[NotificationSchema]:
        notifs = (
            self.db.query(Notification)
            .filter((Notification.user_id == user_id) | (Notification.user_id == None))
            .order_by(Notification.created_at.desc())
            .all()
        )
        return [self._to_schema(n) for n in notifs]

    async def get_unread_count(self, user_id: str) -> int:
        return (
            self.db.query(Notification)
            .filter(
                ((Notification.user_id == user_id) | (Notification.user_id == None)),
                Notification.is_read == False,
            )
            .count()
        )

    async def mark_as_read(
        self, notification_id: str, user_id: str
    ) -> Optional[NotificationSchema]:
        notif = self.db.query(Notification).filter(Notification.id == notification_id).first()
        if not notif:
            return None
        notif.is_read = True
        self.db.commit()
        self.db.refresh(notif)
        return self._to_schema(notif)

    async def mark_all_as_read(self, user_id: str) -> int:
        count = (
            self.db.query(Notification)
            .filter(
                ((Notification.user_id == user_id) | (Notification.user_id == None)),
                Notification.is_read == False,
            )
            .update({"is_read": True}, synchronize_session=False)
        )
        self.db.commit()
        return count
