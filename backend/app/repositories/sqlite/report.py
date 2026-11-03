"""
MessMate SQLite Report Repository Implementation
================================================
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.meal import MealInstance
from app.models.menu import MenuVersion
from app.models.schedule import NotificationSchedule
from app.models.response import MealResponse
from app.models.forecast import ForecastRecommendation, VendorDecision
from app.models.outcome import MealOutcome
from app.schemas.meal import MealInstanceSchema
from app.schemas.response import MealCountsSchema
from app.schemas.forecast import ForecastRecommendationSchema, VendorDecisionSchema
from app.schemas.outcome import MealOutcomeSchema
from app.schemas.report import DashboardSummarySchema, MealReportEntrySchema
from app.core.config import settings
from app.repositories.report import IReportRepository


class SqliteReportRepository(IReportRepository):
    def __init__(self, db: Session):
        self.db = db

    async def get_summary(self) -> DashboardSummarySchema:
        total_vendors = self.db.query(User).filter(User.role == "VENDOR").count()
        total_admins = self.db.query(User).filter(User.role == "ADMIN").count()
        configured_schedules = self.db.query(NotificationSchedule).filter(NotificationSchedule.enabled == True).count()
        published_menu = self.db.query(MenuVersion).filter(MenuVersion.status == "PUBLISHED").first()

        upcoming_instances = (
            self.db.query(MealInstance)
            .filter(MealInstance.status.in_(["RESPONSE_OPEN", "UPCOMING"]))
            .order_by(MealInstance.response_deadline.asc())
            .limit(5)
            .all()
        )

        upcoming_schemas = [
            MealInstanceSchema(
                id=i.id,
                meal_date=i.meal_date,
                meal_type=i.meal_type,
                menu_version_id=i.menu_version_id,
                response_deadline=i.response_deadline,
                status=i.status,
            )
            for i in upcoming_instances
        ]

        total_students = (
            self.db.query(User)
            .filter(User.role == "STUDENT", User.status == "ACTIVE")
            .count()
        )

        return DashboardSummarySchema(
            total_students=total_students,
            total_vendors=total_vendors,
            total_admins=total_admins,
            configured_schedules=configured_schedules,
            published_menu_version=published_menu.version_number if published_menu else None,
            upcoming_deadlines=upcoming_schemas,
        )

    async def get_meal_reports(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        meal_type: Optional[str] = None,
    ) -> List[MealReportEntrySchema]:
        query = self.db.query(MealInstance)
        if meal_type:
            query = query.filter(MealInstance.meal_type == meal_type.upper())
        if start_date:
            query = query.filter(MealInstance.meal_date >= start_date)
        if end_date:
            query = query.filter(MealInstance.meal_date <= end_date)

        instances = query.order_by(MealInstance.meal_date.desc()).all()
        results = []

        eligible_students = (
            self.db.query(User.id)
            .filter(User.role == "STUDENT", User.status == "ACTIVE")
            .all()
        )
        eligible_ids = {r[0] for r in eligible_students}
        total_eligible = len(eligible_ids)

        for inst in instances:
            if total_eligible == 0:
                counts = MealCountsSchema(
                    definitely_eating=0,
                    probably_eating=0,
                    not_eating=0,
                    no_response=0,
                    total_registered=0,
                )
            else:
                responses = (
                    self.db.query(MealResponse)
                    .filter(
                        MealResponse.meal_instance_id == inst.id,
                        MealResponse.student_id.in_(eligible_ids),
                    )
                    .all()
                )
                unique_responses = {r.student_id: r.choice for r in responses}
                definitely = sum(1 for c in unique_responses.values() if c == "DEFINITELY_EATING")
                probably = sum(1 for c in unique_responses.values() if c == "PROBABLY_EATING")
                not_eating = sum(1 for c in unique_responses.values() if c == "NOT_EATING")
                total_responded = definitely + probably + not_eating
                no_response = max(0, total_eligible - total_responded)

                counts = MealCountsSchema(
                    definitely_eating=definitely,
                    probably_eating=probably,
                    not_eating=not_eating,
                    no_response=no_response,
                    total_registered=total_eligible,
                )

            rec = self.db.query(ForecastRecommendation).filter(ForecastRecommendation.meal_instance_id == inst.id).first()
            rec_schema = (
                ForecastRecommendationSchema(
                    meal_instance_id=rec.meal_instance_id,
                    baseline_attendance=rec.baseline_attendance,
                    expected_attendance=rec.expected_attendance,
                    safety_margin_fraction=rec.safety_margin_fraction,
                    recommended_portions=rec.recommended_portions,
                    forecast_method=rec.forecast_method,
                    data_quality_status=rec.data_quality_status,
                    explanation=rec.explanation,
                )
                if rec
                else None
            )

            decision = self.db.query(VendorDecision).filter(VendorDecision.meal_instance_id == inst.id).first()
            dec_schema = (
                VendorDecisionSchema(
                    meal_instance_id=decision.meal_instance_id,
                    original_recommendation=decision.original_recommendation,
                    final_planned_quantity=decision.final_planned_quantity,
                    override_reason=decision.override_reason,
                    status=decision.status,
                    updated_at=decision.updated_at.isoformat() if hasattr(decision.updated_at, "isoformat") else str(decision.updated_at),
                )
                if decision
                else None
            )

            outcome = self.db.query(MealOutcome).filter(MealOutcome.meal_instance_id == inst.id).first()
            out_schema = (
                MealOutcomeSchema(
                    meal_instance_id=outcome.meal_instance_id,
                    actual_attendance=outcome.actual_attendance,
                    actual_prepared_quantity=outcome.actual_prepared_quantity,
                    prepared_unit=outcome.prepared_unit,
                    leftover_quantity=outcome.leftover_quantity,
                    leftover_unit=outcome.leftover_unit,
                    notes=outcome.notes,
                    recorded_at=outcome.recorded_at.isoformat() if hasattr(outcome.recorded_at, "isoformat") else str(outcome.recorded_at),
                )
                if outcome
                else None
            )

            results.append(
                MealReportEntrySchema(
                    meal_instance_id=inst.id,
                    meal_date=inst.meal_date,
                    meal_type=inst.meal_type,
                    counts=counts,
                    recommendation=rec_schema,
                    decision=dec_schema,
                    outcome=out_schema,
                )
            )

        return results
