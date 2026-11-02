from typing import Optional
from app.schemas.base import CamelModel

class MealOutcomeSchema(CamelModel):
    meal_instance_id: str
    actual_attendance: Optional[int] = None
    actual_prepared_quantity: Optional[int] = None
    prepared_unit: str = "portions"
    leftover_quantity: Optional[float] = None
    leftover_unit: Optional[str] = "kg"
    notes: Optional[str] = None
    recorded_at: str

class MealOutcomeCreateRequest(CamelModel):
    actual_attendance: Optional[int] = None
    actual_prepared_quantity: Optional[int] = None
    prepared_unit: str = "portions"
    leftover_quantity: Optional[float] = None
    leftover_unit: Optional[str] = "kg"
    notes: Optional[str] = None
