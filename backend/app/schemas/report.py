from typing import List, Optional
from app.schemas.base import CamelModel
from app.schemas.meal import MealInstanceSchema
from app.schemas.response import MealCountsSchema
from app.schemas.forecast import ForecastRecommendationSchema, VendorDecisionSchema
from app.schemas.outcome import MealOutcomeSchema

class DashboardSummarySchema(CamelModel):
    total_students: int
    total_vendors: int
    total_admins: int
    configured_schedules: int
    published_menu_version: Optional[int] = None
    upcoming_deadlines: List[MealInstanceSchema] = []

class MealReportEntrySchema(CamelModel):
    meal_instance_id: str
    meal_date: str
    meal_type: str
    counts: MealCountsSchema
    recommendation: Optional[ForecastRecommendationSchema] = None
    decision: Optional[VendorDecisionSchema] = None
    outcome: Optional[MealOutcomeSchema] = None
