"""
MessMate Notification Repository Interface
==========================================
Defines contract for user-specific notification listing and read status management.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas.notification import NotificationSchema


class INotificationRepository(ABC):
    @abstractmethod
    async def get_for_user(self, user_id: str) -> List[NotificationSchema]:
        """Retrieve notifications for a user or broadcast notifications."""
        pass

    @abstractmethod
    async def get_unread_count(self, user_id: str) -> int:
        """Count unread notifications for a user or broadcast."""
        pass

    @abstractmethod
    async def mark_as_read(
        self, notification_id: str, user_id: str
    ) -> Optional[NotificationSchema]:
        """Mark a notification as read."""
        pass

    @abstractmethod
    async def mark_all_as_read(self, user_id: str) -> int:
        """Mark all notifications for user as read."""
        pass
