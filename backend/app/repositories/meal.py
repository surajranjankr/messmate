"""
MessMate Meal Repository Interface
==================================
Defines contract for scheduled meal instances and deadline-aware status updates.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas.meal import MealInstanceSchema


class IMealRepository(ABC):
    @abstractmethod
    async def get_all(self) -> List[MealInstanceSchema]:
        """Retrieve all scheduled meal instances with refreshed status."""
        pass

    @abstractmethod
    async def get_today(self) -> List[MealInstanceSchema]:
        """Retrieve meal instances for today with refreshed status."""
        pass

    @abstractmethod
    async def get_actionable(self) -> Optional[MealInstanceSchema]:
        """Retrieve next actionable meal instance requiring student attention."""
        pass

    @abstractmethod
    async def get_by_id(self, meal_id: str) -> Optional[MealInstanceSchema]:
        """Retrieve meal instance by id with refreshed status."""
        pass

    @abstractmethod
    async def update_status(self, meal_id: str, new_status: str) -> None:
        """Update meal instance lifecycle status."""
        pass
