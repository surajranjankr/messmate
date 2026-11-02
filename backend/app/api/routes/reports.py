from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
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

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/summary", response_model=DashboardSummarySchema)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Retrieve top-level operational and administrative metrics."""
    total_vendors = db.query(User).filter(User.role == "VENDOR").count()
    total_admins = db.query(User).filter(User.role == "ADMIN").count()
    configured_schedules = db.query(NotificationSchedule).filter(NotificationSchedule.enabled == True).count()
    published_menu = db.query(MenuVersion).filter(MenuVersion.status == "PUBLISHED").first()

    upcoming_instances = (
        db.query(MealInstance)
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

    return DashboardSummarySchema(
        total_students=settings.TOTAL_REGISTERED_STUDENTS,
        total_vendors=total_vendors,
        total_admins=total_admins,
        configured_schedules=configured_schedules,
        published_menu_version=published_menu.version_number if published_menu else None,
        upcoming_deadlines=upcoming_schemas,
    )

@router.get("/meals", response_model=List[MealReportEntrySchema])
def get_meal_reports(
    start_date: Optional[str] = Query(None, alias="startDate"),
    start_date_alt: Optional[str] = Query(None, alias="start_date"),
    end_date: Optional[str] = Query(None, alias="endDate"),
    end_date_alt: Optional[str] = Query(None, alias="end_date"),
    meal_type: Optional[str] = Query(None, alias="mealType"),
    meal_type_alt: Optional[str] = Query(None, alias="meal_type"),
    db: Session = Depends(get_db),
):
    """Retrieve comprehensive per-meal audit logs combining responses, plans, and outcomes."""
    target_start = start_date or start_date_alt
    target_end = end_date or end_date_alt
    target_meal = meal_type or meal_type_alt

    query = db.query(MealInstance)
    if target_meal:
        query = query.filter(MealInstance.meal_type == target_meal.upper())
    if target_start:
        query = query.filter(MealInstance.meal_date >= target_start)
    if target_end:
        query = query.filter(MealInstance.meal_date <= target_end)

    instances = query.order_by(MealInstance.meal_date.desc()).all()
    results = []

    for inst in instances:
        responses = db.query(MealResponse).filter(MealResponse.meal_instance_id == inst.id).all()
        definitely = sum(1 for r in responses if r.choice == "DEFINITELY_EATING")
        probably = sum(1 for r in responses if r.choice == "PROBABLY_EATING")
        not_eating = sum(1 for r in responses if r.choice == "NOT_EATING")
        total_responded = definitely + probably + not_eating
        no_response = max(0, settings.TOTAL_REGISTERED_STUDENTS - total_responded)

        counts = MealCountsSchema(
            definitely_eating=definitely,
            probably_eating=probably,
            not_eating=not_eating,
            no_response=no_response,
            total_registered=settings.TOTAL_REGISTERED_STUDENTS,
        )

        rec = db.query(ForecastRecommendation).filter(ForecastRecommendation.meal_instance_id == inst.id).first()
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

        decision = db.query(VendorDecision).filter(VendorDecision.meal_instance_id == inst.id).first()
        dec_schema = (
            VendorDecisionSchema(
                meal_instance_id=decision.meal_instance_id,
                original_recommendation=decision.original_recommendation,
                final_planned_quantity=decision.final_planned_quantity,
                override_reason=decision.override_reason,
                status=decision.status,
                updated_at=decision.updated_at.isoformat(),
            )
            if decision
            else None
        )

        outcome = db.query(MealOutcome).filter(MealOutcome.meal_instance_id == inst.id).first()
        out_schema = (
            MealOutcomeSchema(
                meal_instance_id=outcome.meal_instance_id,
                actual_attendance=outcome.actual_attendance,
                actual_prepared_quantity=outcome.actual_prepared_quantity,
                prepared_unit=outcome.prepared_unit,
                leftover_quantity=outcome.leftover_quantity,
                leftover_unit=outcome.leftover_unit,
                notes=outcome.notes,
                recorded_at=outcome.recorded_at.isoformat(),
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
