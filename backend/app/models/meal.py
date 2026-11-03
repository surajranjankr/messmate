from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class MealInstance(Base):
    __tablename__ = "meal_instances"

    id = Column(String(64), primary_key=True, index=True)
    meal_date = Column(String(32), nullable=False, index=True)  # YYYY-MM-DD
    meal_type = Column(String(32), nullable=False)              # BREAKFAST, LUNCH, SNACKS, DINNER
    menu_version_id = Column(String(64), ForeignKey("menu_versions.id"), nullable=False, index=True)
    response_deadline = Column(String(64), nullable=False)      # ISO 8601 with timezone (e.g. Asia/Kolkata)
    response_open_time = Column(String(64), nullable=True)     # ISO 8601 with timezone (e.g. Asia/Kolkata)
    status = Column(String(32), default="UPCOMING", nullable=False) # UPCOMING, RESPONSE_OPEN, RESPONSE_CLOSED, COMPLETED

    menu_version = relationship("MenuVersion", back_populates="meal_instances")
    responses = relationship("MealResponse", back_populates="meal_instance", cascade="all, delete-orphan")
    recommendation = relationship("ForecastRecommendation", back_populates="meal_instance", uselist=False, cascade="all, delete-orphan")
    decision = relationship("VendorDecision", back_populates="meal_instance", uselist=False, cascade="all, delete-orphan")
    outcome = relationship("MealOutcome", back_populates="meal_instance", uselist=False, cascade="all, delete-orphan")
