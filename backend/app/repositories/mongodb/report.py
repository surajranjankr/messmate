"""
MessMate MongoDB Report Repository Implementation
=================================================
Implements IReportRepository using Motor async driver against MongoDB Atlas.
Aggregates operational metrics and per-meal audit summaries.
"""

from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.report import IReportRepository
from app.schemas.meal import MealInstanceSchema
from app.schemas.response import MealCountsSchema
from app.schemas.forecast import ForecastRecommendationSchema, VendorDecisionSchema
from app.schemas.outcome import MealOutcomeSchema
from app.schemas.report import DashboardSummarySchema, MealReportEntrySchema
from app.core.config import settings


class MongoReportRepository(IReportRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users = db.users
        self.schedules = db.notification_schedules
        self.menus = db.menu_versions
        self.meals = db.meal_instances
        self.responses = db.meal_responses

    async def get_summary(self) -> DashboardSummarySchema:
        total_vendors = await self.users.count_documents({"role": "VENDOR"})
        total_admins = await self.users.count_documents({"role": "ADMIN"})
        configured_schedules = await self.schedules.count_documents({"enabled": True})
        published_menu = await self.menus.find_one({"status": "PUBLISHED"})

        cursor = (
            self.meals.find({"status": {"$in": ["RESPONSE_OPEN", "UPCOMING"]}})
            .sort("response_deadline", 1)
            .limit(5)
        )
        upcoming_docs = await cursor.to_list(length=5)

        upcoming_schemas = [
            MealInstanceSchema(
                id=str(d["_id"]),
                meal_date=str(d.get("meal_date", "")),
                meal_type=str(d.get("meal_type", "")),
                menu_version_id=str(d.get("menu_version_id", "")),
                response_deadline=str(d.get("response_deadline", "")),
                status=str(d.get("status", "UPCOMING")),
            )
            for d in upcoming_docs
        ]

        total_students = await self.users.count_documents({"role": "STUDENT", "status": "ACTIVE"})

        return DashboardSummarySchema(
            total_students=total_students,
            total_vendors=total_vendors,
            total_admins=total_admins,
            configured_schedules=configured_schedules,
            published_menu_version=published_menu.get("version_number") if published_menu else None,
            upcoming_deadlines=upcoming_schemas,
        )

    async def get_meal_reports(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        meal_type: Optional[str] = None,
    ) -> List[MealReportEntrySchema]:
        query = {}
        if meal_type:
            query["meal_type"] = meal_type.upper()
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query["meal_date"] = date_filter

        cursor = self.meals.find(query).sort("meal_date", -1)
        meal_docs = await cursor.to_list(length=1000)
        results = []

        user_cursor = self.users.find({"role": "STUDENT", "status": "ACTIVE"}, {"_id": 1})
        eligible_docs = await user_cursor.to_list(length=100000)
        eligible_ids = {str(d["_id"]) for d in eligible_docs}
        total_eligible = len(eligible_ids)

        for m in meal_docs:
            mid = str(m["_id"])
            if total_eligible == 0:
                counts = MealCountsSchema(
                    definitely_eating=0,
                    probably_eating=0,
                    not_eating=0,
                    no_response=0,
                    total_registered=0,
                )
            else:
                resp_cursor = self.responses.find({
                    "meal_instance_id": mid,
                    "student_id": {"$in": list(eligible_ids)},
                })
                resp_docs = await resp_cursor.to_list(length=100000)

                unique_responses = {str(r.get("student_id")): r.get("choice") for r in resp_docs}
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

            rec_doc = m.get("recommendation")
            rec_schema = (
                ForecastRecommendationSchema(
                    meal_instance_id=mid,
                    baseline_attendance=rec_doc.get("baseline_attendance", total_eligible),
                    expected_attendance=rec_doc.get("expected_attendance", 0.0),
                    safety_margin_fraction=rec_doc.get("safety_margin_fraction", 0.08),
                    recommended_portions=rec_doc.get("recommended_portions"),
                    forecast_method=rec_doc.get("forecast_method", "DYNAMIC_DEMAND_MODEL"),
                    data_quality_status=rec_doc.get("data_quality_status", "SUFFICIENT"),
                    explanation=rec_doc.get("explanation", ""),
                )
                if rec_doc
                else None
            )

            dec_doc = m.get("vendor_decision")
            dec_schema = (
                VendorDecisionSchema(
                    meal_instance_id=mid,
                    original_recommendation=dec_doc.get("original_recommendation"),
                    final_planned_quantity=dec_doc.get("final_planned_quantity"),
                    override_reason=dec_doc.get("override_reason"),
                    status=dec_doc.get("status", "ACCEPTED"),
                    updated_at=str(dec_doc.get("updated_at", "")),
                )
                if dec_doc
                else None
            )

            out_doc = m.get("outcome")
            out_schema = (
                MealOutcomeSchema(
                    meal_instance_id=mid,
                    actual_attendance=out_doc.get("actual_attendance"),
                    actual_prepared_quantity=out_doc.get("actual_prepared_quantity"),
                    prepared_unit=out_doc.get("prepared_unit", "portions"),
                    leftover_quantity=out_doc.get("leftover_quantity"),
                    leftover_unit=out_doc.get("leftover_unit"),
                    notes=out_doc.get("notes"),
                    recorded_at=str(out_doc.get("recorded_at", "")),
                )
                if out_doc
                else None
            )

            results.append(
                MealReportEntrySchema(
                    meal_instance_id=mid,
                    meal_date=str(m.get("meal_date", "")),
                    meal_type=str(m.get("meal_type", "")),
                    counts=counts,
                    recommendation=rec_schema,
                    decision=dec_schema,
                    outcome=out_schema,
                )
            )

        return results
