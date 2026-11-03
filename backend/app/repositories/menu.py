"""
MessMate Menu Repository Interface
==================================
Defines contract for menu versioning, drafts, publishing, and dish querying
independent of underlying persistence engine.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas.menu import (
    MenuVersionSchema,
    MenuMealEntrySchema,
    DraftSaveRequest,
    PublishRequest,
)


class IMenuRepository(ABC):
    @abstractmethod
    async def get_published(self) -> Optional[MenuVersionSchema]:
        """Retrieve active published menu version."""
        pass

    @abstractmethod
    async def get_draft(self) -> Optional[MenuVersionSchema]:
        """Retrieve current draft menu version if exists."""
        pass

    @abstractmethod
    async def get_by_id(self, version_id: str) -> Optional[MenuVersionSchema]:
        """Retrieve menu version by id."""
        pass

    @abstractmethod
    async def save_draft(self, request: DraftSaveRequest) -> MenuVersionSchema:
        """Create or update draft menu version."""
        pass

    @abstractmethod
    async def discard_draft(self) -> None:
        """Delete current draft menu version."""
        pass

    @abstractmethod
    async def publish_draft(self, request: PublishRequest) -> MenuVersionSchema:
        """Publish current draft as immutable version and archive previous published."""
        pass

    @abstractmethod
    async def get_history(self) -> List[MenuVersionSchema]:
        """Retrieve all menu versions ordered latest first."""
        pass

    @abstractmethod
    async def get_meal_entry(
        self, day_of_week: str, meal_type: str, version_id: Optional[str] = None
    ) -> Optional[MenuMealEntrySchema]:
        """Retrieve menu entry for specific day and meal slot."""
        pass
