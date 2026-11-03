"""
MessMate Institution Configuration Schemas
==========================================
Validation and serialization for institutional parameters and safety margin.
"""

from typing import Optional
from pydantic import Field, field_validator
from app.schemas.base import CamelModel
from app.core.timezone import validate_timezone_name


class InstitutionSettingSchema(CamelModel):
    id: str = "default"
    institution_name: str
    timezone: str
    safety_margin_fraction: float  # Stored as decimal: 0.08 = 8%, 0.20 = 20%
    safety_margin_percentage: float  # Display convenience: 8.0 = 8%, 20.0 = 20%
    updated_at: str


class InstitutionSettingUpdate(CamelModel):
    institution_name: Optional[str] = None
    timezone: Optional[str] = None
    safety_margin_fraction: Optional[float] = None
    safety_margin_percentage: Optional[float] = None

    @field_validator("timezone")
    @classmethod
    def validate_tz(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_timezone_name(v)
        return v

    @field_validator("safety_margin_fraction")
    @classmethod
    def validate_fraction(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            # If input is between 1.0 and 50.0, convert to decimal fraction
            if 1.0 < v <= 50.0:
                v = v / 100.0
            if v < 0.0 or v > 0.50:
                raise ValueError("Safety margin must be between 0.0 and 0.50 (0% to 50%).")
        return v

    @field_validator("safety_margin_percentage")
    @classmethod
    def validate_percentage(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v < 0.0 or v > 50.0:
                raise ValueError("Safety margin percentage must be between 0% and 50%.")
        return v
