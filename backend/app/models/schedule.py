from sqlalchemy import Column, String, Boolean, Integer
from app.db.session import Base

class NotificationSchedule(Base):
    __tablename__ = "notification_schedules"

    id = Column(String(64), primary_key=True, index=True)
    day_of_week = Column(String(32), nullable=False)  # MONDAY ... SUNDAY
    meal_type = Column(String(32), nullable=False)    # BREAKFAST, LUNCH, SNACKS, DINNER
    enabled = Column(Boolean, default=True, nullable=False)
    notify_send_time = Column(String(16), nullable=False)       # "21:00"
    response_deadline_time = Column(String(16), nullable=False) # "22:00"
    meal_date_offset = Column(Integer, default=0, nullable=False) # 0 = same day, 1 = evening before
    timezone = Column(String(32), default="Asia/Kolkata", nullable=False)
    overlap_acknowledged = Column(Boolean, default=False, nullable=False)
