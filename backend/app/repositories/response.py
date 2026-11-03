"""
MessMate Student Response Repository Interface
===============================================
Defines contract for student intentions and aggregate attendance counts.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas.response import MealResponseSchema, MealCountsSchema


class IResponseRepository(ABC):
    @abstractmethod
    async def get_by_student_and_meal(
        self, student_id: str, meal_instance_id: str
    ) -> Optional[MealResponseSchema]:
        """Retrieve student's response for a given meal."""
        pass

    @abstractmethod
    async def save_response(
        self, student_id: str, meal_instance_id: str, choice: str
    ) -> MealResponseSchema:
        """Submit or update student meal intention."""
        pass

    @abstractmethod
    async def get_history_by_student(
        self, student_id: str
    ) -> List[MealResponseSchema]:
        """Retrieve personal response history for a student."""
        pass

    @abstractmethod
    async def get_counts_by_meal(
        self, meal_instance_id: str
    ) -> MealCountsSchema:
        """Calculate aggregate response counts distinguishing No Response from Not Eating."""
        pass
