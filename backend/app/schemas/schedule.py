from typing import List, Optional
from app.schemas.base import CamelModel

class NotificationScheduleSchema(CamelModel):
    id: str
    day_of_week: str
    meal_type: str
    enabled: bool
    notify_send_time: str
    response_deadline_time: str
    meal_date_offset: int
    timezone: str = "Asia/Kolkata"
    overlap_acknowledged: Optional[bool] = False

class ScheduleUpdateRequest(CamelModel):
    notify_send_time: Optional[str] = None
    response_deadline_time: Optional[str] = None
    meal_date_offset: Optional[int] = None
    enabled: Optional[bool] = None
    overlap_acknowledged: Optional[bool] = None

class ScheduleValidationError(CamelModel):
    schedule_id: str
    field: str
    message: str

class ScheduleOverlapWarning(CamelModel):
    schedule1_id: str
    schedule2_id: str
    schedule1_label: str
    schedule2_label: str
    overlap_description: str
    acknowledged: bool

class ScheduleValidationResult(CamelModel):
    is_valid: bool
    errors: List[ScheduleValidationError] = []
    warnings: List[ScheduleOverlapWarning] = []

class AcknowledgeOverlapRequest(CamelModel):
    schedule1_id: Optional[str] = None
    schedule2_id: Optional[str] = None
    schedule_id: Optional[str] = None
    acknowledged: Optional[bool] = True
