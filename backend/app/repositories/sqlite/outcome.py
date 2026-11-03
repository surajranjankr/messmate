"""
MessMate SQLite Outcome Repository Implementation
=================================================
"""

from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.outcome import MealOutcome
from app.schemas.outcome import MealOutcomeSchema, MealOutcomeCreateRequest
from app.repositories.outcome import IOutcomeRepository


class SqliteOutcomeRepository(IOutcomeRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_schema(self, o: MealOutcome) -> MealOutcomeSchema:
        return MealOutcomeSchema(
            meal_instance_id=o.meal_instance_id,
            actual_attendance=o.actual_attendance,
            actual_prepared_quantity=o.actual_prepared_quantity,
            prepared_unit=o.prepared_unit,
            leftover_quantity=o.leftover_quantity,
            leftover_unit=o.leftover_unit,
            notes=o.notes,
            recorded_at=o.recorded_at.isoformat() if hasattr(o.recorded_at, "isoformat") else str(o.recorded_at),
        )

    async def get_all(self) -> List[MealOutcomeSchema]:
        outcomes = self.db.query(MealOutcome).order_by(MealOutcome.recorded_at.desc()).all()
        return [self._to_schema(o) for o in outcomes]

    async def get_by_meal(self, meal_id: str) -> Optional[MealOutcomeSchema]:
        outcome = self.db.query(MealOutcome).filter(MealOutcome.meal_instance_id == meal_id).first()
        return self._to_schema(outcome) if outcome else None

    async def save_outcome(
        self, meal_id: str, request: MealOutcomeCreateRequest
    ) -> MealOutcomeSchema:
        outcome = self.db.query(MealOutcome).filter(MealOutcome.meal_instance_id == meal_id).first()
        now = datetime.now(timezone.utc)

        if outcome:
            outcome.actual_attendance = request.actual_attendance
            outcome.actual_prepared_quantity = request.actual_prepared_quantity
            outcome.prepared_unit = request.prepared_unit or "portions"
            outcome.leftover_quantity = request.leftover_quantity
            outcome.leftover_unit = request.leftover_unit if request.leftover_quantity is not None else None
            outcome.notes = request.notes.strip() if request.notes else None
            outcome.recorded_at = now
        else:
            outcome = MealOutcome(
                meal_instance_id=meal_id,
                actual_attendance=request.actual_attendance,
                actual_prepared_quantity=request.actual_prepared_quantity,
                prepared_unit=request.prepared_unit or "portions",
                leftover_quantity=request.leftover_quantity,
                leftover_unit=request.leftover_unit if request.leftover_quantity is not None else None,
                notes=request.notes.strip() if request.notes else None,
                recorded_at=now,
            )
            self.db.add(outcome)

        self.db.commit()
        self.db.refresh(outcome)
        return self._to_schema(outcome)
