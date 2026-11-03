from typing import Optional
from app.schemas.base import CamelModel

class ForecastRecommendationSchema(CamelModel):
    meal_instance_id: str
    baseline_attendance: int  # Total eligible students (T)
    expected_attendance: float  # Expected demand (e.g., 2.1, 1.5)
    safety_margin_fraction: float
    recommended_portions: Optional[int] = None  # None or portions
    forecast_method: str
    data_quality_status: str
    explanation: str
    definitely_eating: Optional[int] = None
    probably_eating: Optional[int] = None
    not_eating: Optional[int] = None
    no_response: Optional[int] = None
    nonresponse_attendance_rate: Optional[float] = None

class VendorDecisionSchema(CamelModel):
    meal_instance_id: str
    original_recommendation: Optional[int] = None
    final_planned_quantity: int
    override_reason: Optional[str] = None
    status: str
    updated_at: str

class VendorDecisionCreateRequest(CamelModel):
    final_planned_quantity: int
    override_reason: Optional[str] = None
