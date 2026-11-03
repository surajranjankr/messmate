"""
MessMate Schedule Repository Interface
======================================
Defines contract for notification schedule maintenance, overlap detection,
and validation.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas.schedule import (
    NotificationScheduleSchema,
    ScheduleUpdateRequest,
    ScheduleValidationResult,
)


class IScheduleRepository(ABC):
    @abstractmethod
    async def get_all(self) -> List[NotificationScheduleSchema]:
        """Retrieve all notification schedules."""
        pass

    @abstractmethod
    async def get_by_id(self, schedule_id: str) -> Optional[NotificationScheduleSchema]:
        """Retrieve specific schedule by id."""
        pass

    @abstractmethod
    async def update(
        self, schedule_id: str, request: ScheduleUpdateRequest
    ) -> NotificationScheduleSchema:
        """Update a specific schedule with validation check."""
        pass

    @abstractmethod
    async def validate(self) -> ScheduleValidationResult:
        """Run validation checks across all active notification schedules."""
        pass

    @abstractmethod
    async def acknowledge_overlap(
        self, schedule_ids: List[str], acknowledged: bool
    ) -> int:
        """Acknowledge or clear overlap for specified schedules."""
        pass
