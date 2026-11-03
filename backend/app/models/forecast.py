from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class ForecastRecommendation(Base):
    __tablename__ = "forecast_recommendations"

    meal_instance_id = Column(String(64), ForeignKey("meal_instances.id", ondelete="CASCADE"), primary_key=True)
    baseline_attendance = Column(Integer, default=0, nullable=False)
    expected_attendance = Column(Float, default=0.0, nullable=False)
    safety_margin_fraction = Column(Float, default=0.08, nullable=False)
    recommended_portions = Column(Integer, default=None, nullable=True)
    forecast_method = Column(String(64), default="DYNAMIC_DEMAND_MODEL", nullable=False)
    data_quality_status = Column(String(64), default="SUFFICIENT", nullable=False)
    explanation = Column(String(1024), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    meal_instance = relationship("MealInstance", back_populates="recommendation")


class VendorDecision(Base):
    __tablename__ = "vendor_decisions"

    meal_instance_id = Column(String(64), ForeignKey("meal_instances.id", ondelete="CASCADE"), primary_key=True)
    original_recommendation = Column(Integer, nullable=True)
    final_planned_quantity = Column(Integer, nullable=False)
    override_reason = Column(String(512), nullable=True)
    status = Column(String(32), default="ACCEPTED", nullable=False) # ACCEPTED, OVERRIDDEN, CONFIRMED
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    meal_instance = relationship("MealInstance", back_populates="decision")
