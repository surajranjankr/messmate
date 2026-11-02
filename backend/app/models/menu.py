from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class MenuVersion(Base):
    __tablename__ = "menu_versions"

    id = Column(String(64), primary_key=True, index=True)
    version_number = Column(Integer, nullable=False, index=True)
    status = Column(String(32), nullable=False)  # DRAFT, PUBLISHED, ARCHIVED
    change_summary = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)

    meals = relationship("MenuMealEntry", back_populates="menu_version", cascade="all, delete-orphan")
    meal_instances = relationship("MealInstance", back_populates="menu_version")


class MenuMealEntry(Base):
    __tablename__ = "menu_meal_entries"

    id = Column(String(64), primary_key=True, index=True)
    menu_version_id = Column(String(64), ForeignKey("menu_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(String(32), nullable=False)  # MONDAY ... SUNDAY
    meal_type = Column(String(32), nullable=False)    # BREAKFAST, LUNCH, SNACKS, DINNER
    accompaniments = Column(JSON, default=list, nullable=False)
    notes = Column(JSON, default=list, nullable=False)

    menu_version = relationship("MenuVersion", back_populates="meals")
    dishes = relationship("DishItem", back_populates="meal_entry", cascade="all, delete-orphan")


class DishItem(Base):
    __tablename__ = "dish_items"

    id = Column(String(64), primary_key=True, index=True)
    menu_meal_entry_id = Column(String(64), ForeignKey("menu_meal_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    alternatives = Column(JSON, default=list, nullable=True)
    category = Column(String(64), nullable=True)

    meal_entry = relationship("MenuMealEntry", back_populates="dishes")
