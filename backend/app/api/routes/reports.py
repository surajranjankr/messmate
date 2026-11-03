from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from app.schemas.report import DashboardSummarySchema, MealReportEntrySchema
from app.repositories.report import IReportRepository
from app.dependencies.repositories import get_report_repository

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary", response_model=DashboardSummarySchema)
async def get_dashboard_summary(report_repo: IReportRepository = Depends(get_report_repository)):
    """Retrieve top-level operational and administrative metrics."""
    return await report_repo.get_summary()


@router.get("/meals", response_model=List[MealReportEntrySchema])
async def get_meal_reports(
    start_date: Optional[str] = Query(None, alias="startDate"),
    start_date_alt: Optional[str] = Query(None, alias="start_date"),
    end_date: Optional[str] = Query(None, alias="endDate"),
    end_date_alt: Optional[str] = Query(None, alias="end_date"),
    meal_type: Optional[str] = Query(None, alias="mealType"),
    meal_type_alt: Optional[str] = Query(None, alias="meal_type"),
    report_repo: IReportRepository = Depends(get_report_repository),
):
    """Retrieve comprehensive per-meal audit logs combining responses, plans, and outcomes."""
    target_start = start_date or start_date_alt
    target_end = end_date or end_date_alt
    target_meal = meal_type or meal_type_alt

    return await report_repo.get_meal_reports(
        start_date=target_start,
        end_date=target_end,
        meal_type=target_meal,
    )
