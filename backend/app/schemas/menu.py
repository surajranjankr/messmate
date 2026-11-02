from typing import List, Optional
from app.schemas.base import CamelModel

class DishItemSchema(CamelModel):
    id: str
    name: str
    alternatives: Optional[List[str]] = None
    category: Optional[str] = None

class MenuMealEntrySchema(CamelModel):
    id: str
    day_of_week: str
    meal_type: str
    dishes: List[DishItemSchema] = []
    accompaniments: List[str] = []
    notes: List[str] = []

class MenuVersionSchema(CamelModel):
    id: str
    version_number: int
    status: str
    meals: List[MenuMealEntrySchema] = []
    created_at: str
    published_at: Optional[str] = None
    change_summary: Optional[str] = None

class DraftSaveRequest(CamelModel):
    meals: List[MenuMealEntrySchema] = []
    change_summary: Optional[str] = None

class PublishRequest(CamelModel):
    change_summary: Optional[str] = "Published update"
