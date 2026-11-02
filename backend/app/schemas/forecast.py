from typing import Optional
from app.schemas.base import CamelModel

class ForecastRecommendationSchema(CamelModel):
    meal_instance_id: str
    baseline_attendance: int
    expected_attendance: int
    safety_margin_fraction: float
    recommended_portions: int
    forecast_method: str
    data_quality_status: str
    explanation: str

class VendorDecisionSchema(CamelModel):
    meal_instance_id: str
    original_recommendation: int
    final_planned_quantity: int
    override_reason: Optional[str] = None
    status: str
    updated_at: str

class VendorDecisionCreateRequest(CamelModel):
    final_planned_quantity: int
    override_reason: Optional[str] = None
