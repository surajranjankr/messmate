"""
MessMate Institution Configuration Model
========================================
Persists institutional catering parameters:
- Institution display name
- System timezone (default: Asia/Kolkata)
- Provisional safety margin fraction (e.g. 0.08 for 8%, 0.20 for 20%)
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime
from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


class InstitutionSetting(Base):
    __tablename__ = "institution_settings"

    id = Column(String(64), primary_key=True, default="default")
    institution_name = Column(
        String(256),
        nullable=False,
        default="Indian Institute of Information Technology Dharwad",
    )
    timezone = Column(String(64), nullable=False, default="Asia/Kolkata")
    safety_margin_fraction = Column(Float, nullable=False, default=0.08)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
