from typing import Optional
from app.schemas.base import CamelModel

class ResponseSubmitRequest(CamelModel):
    meal_instance_id: Optional[str] = None
    choice: str  # DEFINITELY_EATING, PROBABLY_EATING, NOT_EATING

class MealResponseSchema(CamelModel):
    id: str
    student_id: str
    meal_instance_id: str
    choice: str
    created_at: str
    updated_at: str

class MealCountsSchema(CamelModel):
    definitely_eating: int
    probably_eating: int
    not_eating: int
    no_response: int
    total_registered: int
