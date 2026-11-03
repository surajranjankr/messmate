"""
MessMate Forecast & Vendor Decision Repository Interface
=========================================================
Defines contract for attendance forecasting recommendations and vendor batch decisions.
"""

from abc import ABC, abstractmethod
from typing import Optional
from app.schemas.forecast import ForecastRecommendationSchema, VendorDecisionSchema


class IForecastRepository(ABC):
    @abstractmethod
    async def get_recommendation(
        self, meal_id: str
    ) -> ForecastRecommendationSchema:
        """Retrieve or compute preparation recommendation for a meal instance."""
        pass

    @abstractmethod
    async def get_decision(
        self, meal_id: str
    ) -> Optional[VendorDecisionSchema]:
        """Retrieve vendor confirmed batch decision for a meal instance."""
        pass

    @abstractmethod
    async def save_decision(
        self, meal_id: str, planned_quantity: int, override_reason: Optional[str] = None
    ) -> VendorDecisionSchema:
        """Save or update vendor planned preparation quantity, tracking overrides."""
        pass
