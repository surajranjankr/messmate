"""
MessMate Meal Outcome Repository Interface
==========================================
Defines contract for recording and retrieving actual attendance, prepared portions,
and leftover quantities.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas.outcome import MealOutcomeSchema, MealOutcomeCreateRequest


class IOutcomeRepository(ABC):
    @abstractmethod
    async def get_all(self) -> List[MealOutcomeSchema]:
        """Retrieve all recorded post-meal outcome entries."""
        pass

    @abstractmethod
    async def get_by_meal(self, meal_id: str) -> Optional[MealOutcomeSchema]:
        """Retrieve outcome for a specific meal instance."""
        pass

    @abstractmethod
    async def save_outcome(
        self, meal_id: str, request: MealOutcomeCreateRequest
    ) -> MealOutcomeSchema:
        """Record or update post-meal outcome measurements."""
        pass
