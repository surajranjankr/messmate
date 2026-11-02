from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class MealResponse(Base):
    __tablename__ = "meal_responses"

    id = Column(String(64), primary_key=True, index=True)
    student_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    meal_instance_id = Column(String(64), ForeignKey("meal_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    choice = Column(String(32), nullable=False)  # DEFINITELY_EATING, PROBABLY_EATING, NOT_EATING
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("student_id", "meal_instance_id", name="uq_student_meal_response"),
    )

    student = relationship("User", back_populates="responses")
    meal_instance = relationship("MealInstance", back_populates="responses")
