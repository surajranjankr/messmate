"""
MessMate Report Repository Interface
====================================
Defines contract for operational summaries and historical meal performance audits.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from app.schemas.report import DashboardSummarySchema, MealReportEntrySchema


class IReportRepository(ABC):
    @abstractmethod
    async def get_summary(self) -> DashboardSummarySchema:
        """Retrieve operational and administrative summary metrics."""
        pass

    @abstractmethod
    async def get_meal_reports(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        meal_type: Optional[str] = None,
    ) -> List[MealReportEntrySchema]:
        """Retrieve per-meal reports combining attendance, forecasts, and outcomes."""
        pass
