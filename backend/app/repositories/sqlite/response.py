"""
MessMate SQLite Student Response Repository Implementation
==========================================================
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.response import MealResponse
from app.models.user import User
from app.schemas.response import MealResponseSchema, MealCountsSchema
from app.repositories.response import IResponseRepository


class SqliteResponseRepository(IResponseRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_schema(self, resp: MealResponse) -> MealResponseSchema:
        return MealResponseSchema(
            id=resp.id,
            student_id=resp.student_id,
            meal_instance_id=resp.meal_instance_id,
            choice=resp.choice,
            created_at=resp.created_at.isoformat() if hasattr(resp.created_at, "isoformat") else str(resp.created_at),
            updated_at=resp.updated_at.isoformat() if hasattr(resp.updated_at, "isoformat") else str(resp.updated_at),
        )

    async def get_by_student_and_meal(
        self, student_id: str, meal_instance_id: str
    ) -> Optional[MealResponseSchema]:
        resp = (
            self.db.query(MealResponse)
            .filter(
                MealResponse.student_id == student_id,
                MealResponse.meal_instance_id == meal_instance_id,
            )
            .first()
        )
        return self._to_schema(resp) if resp else None

    async def save_response(
        self, student_id: str, meal_instance_id: str, choice: str
    ) -> MealResponseSchema:
        now = datetime.now(timezone.utc)
        existing = (
            self.db.query(MealResponse)
            .filter(
                MealResponse.student_id == student_id,
                MealResponse.meal_instance_id == meal_instance_id,
            )
            .first()
        )

        if existing:
            existing.choice = choice
            existing.updated_at = now
            self.db.commit()
            self.db.refresh(existing)
            return self._to_schema(existing)
        else:
            new_resp = MealResponse(
                id=f"resp-{uuid.uuid4().hex[:8]}",
                student_id=student_id,
                meal_instance_id=meal_instance_id,
                choice=choice,
                created_at=now,
                updated_at=now,
            )
            self.db.add(new_resp)
            self.db.commit()
            self.db.refresh(new_resp)
            return self._to_schema(new_resp)

    async def get_history_by_student(
        self, student_id: str
    ) -> List[MealResponseSchema]:
        responses = (
            self.db.query(MealResponse)
            .filter(MealResponse.student_id == student_id)
            .order_by(MealResponse.created_at.desc())
            .all()
        )
        return [self._to_schema(r) for r in responses]

    async def get_counts_by_meal(
        self, meal_instance_id: str
    ) -> MealCountsSchema:
        # Dynamically query eligible active students
        eligible_students = (
            self.db.query(User.id)
            .filter(User.role == "STUDENT", User.status == "ACTIVE")
            .all()
        )
        eligible_ids = {r[0] for r in eligible_students}
        total_eligible = len(eligible_ids)

        if total_eligible == 0:
            return MealCountsSchema(
                definitely_eating=0,
                probably_eating=0,
                not_eating=0,
                no_response=0,
                total_registered=0,
            )

        responses = (
            self.db.query(MealResponse)
            .filter(
                MealResponse.meal_instance_id == meal_instance_id,
                MealResponse.student_id.in_(eligible_ids),
            )
            .all()
        )
        # Deduplicate per student to guarantee unique count
        unique_responses = {r.student_id: r.choice for r in responses}

        definitely = sum(1 for c in unique_responses.values() if c == "DEFINITELY_EATING")
        probably = sum(1 for c in unique_responses.values() if c == "PROBABLY_EATING")
        not_eating = sum(1 for c in unique_responses.values() if c == "NOT_EATING")

        total_responded = definitely + probably + not_eating
        no_response = max(0, total_eligible - total_responded)

        return MealCountsSchema(
            definitely_eating=definitely,
            probably_eating=probably,
            not_eating=not_eating,
            no_response=no_response,
            total_registered=total_eligible,
        )
