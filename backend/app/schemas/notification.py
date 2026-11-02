from typing import Optional
from app.schemas.base import CamelModel

class NotificationSchema(CamelModel):
    id: str
    title: str
    message: str
    created_at: str
    is_read: bool
    meal_instance_id: Optional[str] = None
