from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class MealOutcome(Base):
    __tablename__ = "meal_outcomes"

    meal_instance_id = Column(String(64), ForeignKey("meal_instances.id", ondelete="CASCADE"), primary_key=True)
    actual_attendance = Column(Integer, nullable=True) # headcount in students
    actual_prepared_quantity = Column(Integer, nullable=True) # portions
    prepared_unit = Column(String(32), default="portions", nullable=False)
    leftover_quantity = Column(Float, nullable=True)
    leftover_unit = Column(String(32), default="kg", nullable=True)
    notes = Column(String(1024), nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    meal_instance = relationship("MealInstance", back_populates="outcome")
