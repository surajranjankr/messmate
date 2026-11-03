from typing import Optional
from app.schemas.base import CamelModel

class MealInstanceSchema(CamelModel):
    id: str
    meal_date: str
    meal_type: str
    menu_version_id: str
    response_deadline: str
    response_open_time: Optional[str] = None
    status: str
