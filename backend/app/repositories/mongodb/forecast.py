"""
MessMate MongoDB Forecast Repository Implementation
==================================================
Dynamic demand forecasting engine based on actual student population,
recorded responses, historical attendance rate, and safety margin.
Implements IForecastRepository using Motor async driver against MongoDB.
"""

import math
from datetime import datetime, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.forecast import IForecastRepository
from app.schemas.forecast import ForecastRecommendationSchema, VendorDecisionSchema
from app.core.config import settings


class MongoForecastRepository(IForecastRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.meal_instances

    async def _calculate_historical_rate(
        self, meal_instance_id: str, meal_type: Optional[str], eligible_ids: set
    ) -> Optional[float]:
        """
        Derives historical nonresponse attendance rate from completed meals with recorded outcomes.
        Prioritizes the same meal type if available.
        """
        past_cursor = self.collection.find({
            "_id": {"$ne": meal_instance_id},
            "outcome.actual_attendance": {"$ne": None},
        })
        past_meals = await past_cursor.to_list(1000)
        if meal_type:
            same_type = [m for m in past_meals if m.get("meal_type") == meal_type]
            pairs = same_type if same_type else past_meals
        else:
            pairs = past_meals

        if not pairs:
            return None

        total_attended_nonresp = 0.0
        total_nonresp = 0
        T = len(eligible_ids)

        for pm in pairs:
            outcome = pm.get("outcome") or {}
            actual_att = outcome.get("actual_attendance")
            if actual_att is None:
                continue

            p_cursor = self.db.meal_responses.find({
                "meal_instance_id": pm["_id"],
                "student_id": {"$in": list(eligible_ids)},
            })
            p_docs = await p_cursor.to_list(10000)
            p_unique = {str(d.get("student_id")): d.get("choice") for d in p_docs}
            p_D = sum(1 for c in p_unique.values() if c == "DEFINITELY_EATING")
            p_P = sum(1 for c in p_unique.values() if c == "PROBABLY_EATING")
            p_N = sum(1 for c in p_unique.values() if c == "NOT_EATING")
            p_R = max(0, T - (p_D + p_P + p_N))

            if p_R > 0:
                resp_demand = (p_D * 1.0) + (p_P * 0.5)
                attended_nonresp = max(0.0, min(float(p_R), float(actual_att) - resp_demand))
                total_attended_nonresp += attended_nonresp
                total_nonresp += p_R

        if total_nonresp > 0:
            return round(max(0.0, min(1.0, total_attended_nonresp / total_nonresp)), 2)
        return None

    async def get_recommendation(
        self, meal_id: str
    ) -> ForecastRecommendationSchema:
        meal = await self.collection.find_one({"_id": meal_id})
        if not meal:
            raise KeyError(f"Meal instance {meal_id} not found.")

        # 1. Total active eligible students
        cursor = self.db.users.find({"role": "STUDENT", "status": "ACTIVE"}, {"_id": 1})
        docs = await cursor.to_list(100000)
        eligible_ids = {str(d["_id"]) for d in docs}
        T = len(eligible_ids)

        # 2. Meal response counts
        if T == 0:
            D, P, N, R = 0, 0, 0, 0
        else:
            resp_cursor = self.db.meal_responses.find({
                "meal_instance_id": meal_id,
                "student_id": {"$in": list(eligible_ids)},
            })
            resp_docs = await resp_cursor.to_list(100000)
            unique_responses = {str(d.get("student_id")): d.get("choice") for d in resp_docs}
            D = sum(1 for c in unique_responses.values() if c == "DEFINITELY_EATING")
            P = sum(1 for c in unique_responses.values() if c == "PROBABLY_EATING")
            N = sum(1 for c in unique_responses.values() if c == "NOT_EATING")
            R = max(0, T - (D + P + N))

        # 3. Nonresponse attendance rate determination
        rate = None
        rate_source = None
        if T > 0 and R > 0:
            hist_rate = await self._calculate_historical_rate(meal_id, meal.get("meal_type"), eligible_ids)
            if hist_rate is not None:
                rate = hist_rate
                rate_source = "HISTORICAL"
            elif settings.DEFAULT_NONRESPONSE_ATTENDANCE_RATE is not None:
                rate = float(settings.DEFAULT_NONRESPONSE_ATTENDANCE_RATE)
                rate_source = "CONFIGURED_FALLBACK"

        # 4. Expected demand and recommended portions calculation
        inst_doc = await self.db.institution_settings.find_one({"_id": "default"})
        m = float(inst_doc["safety_margin_fraction"]) if inst_doc and "safety_margin_fraction" in inst_doc else settings.DEFAULT_SAFETY_MARGIN
        if T == 0:
            F = 0.0
            Q = 0
            method = "ZERO_POPULATION"
            status = "ZERO_POPULATION"
            explanation = "Zero registered active students found."
        elif R > 0 and rate is None:
            F = round((D * 1.0) + (P * 0.5), 2)
            Q = None
            method = "INSUFFICIENT_DATA"
            status = "INSUFFICIENT"
            explanation = "Insufficient response history to generate a reliable preparation recommendation. Please enter a manual preparation quantity."
        else:
            eff_rate = rate if rate is not None else 0.0
            F = round((D * 1.0) + (P * 0.5) + (R * eff_rate), 2)
            Q = math.ceil(F * (1 + m)) if F > 0 else 0
            method = "DYNAMIC_DEMAND_MODEL"
            status = "SUFFICIENT" if rate_source == "HISTORICAL" else "ESTIMATED_FALLBACK"
            explanation = (
                f"Dynamic demand model: {T} active students ({D} definitely, {P} probably, {N} not eating, "
                f"{R} no-response @ {int(eff_rate * 100)}% attendance rate via {rate_source or 'none'}). "
                f"Expected demand F={F:.1f}, with {int(m * 100)}% safety margin -> {Q} portions."
            )

        # 5. Persist recommendation only in isolated test / non-production databases to strictly protect production Atlas data
        rec_doc = {
            "baseline_attendance": T,
            "expected_attendance": F,
            "safety_margin_fraction": m,
            "recommended_portions": Q,
            "forecast_method": method,
            "data_quality_status": status,
            "explanation": explanation,
            "definitely_eating": D,
            "probably_eating": P,
            "not_eating": N,
            "no_response": R,
            "nonresponse_attendance_rate": rate,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if self.db.name != settings.MONGODB_DATABASE:
            await self.collection.update_one(
                {"_id": meal_id},
                {"$set": {"recommendation": rec_doc}},
            )

        return ForecastRecommendationSchema(
            meal_instance_id=meal_id,
            baseline_attendance=T,
            expected_attendance=F,
            safety_margin_fraction=m,
            recommended_portions=Q,
            forecast_method=method,
            data_quality_status=status,
            explanation=explanation,
            definitely_eating=D,
            probably_eating=P,
            not_eating=N,
            no_response=R,
            nonresponse_attendance_rate=rate,
        )

    async def get_decision(
        self, meal_id: str
    ) -> Optional[VendorDecisionSchema]:
        meal = await self.collection.find_one({"_id": meal_id})
        if not meal:
            return None

        dec = meal.get("vendor_decision")
        if not dec:
            return None

        return VendorDecisionSchema(
            meal_instance_id=meal_id,
            original_recommendation=dec.get("original_recommendation"),
            final_planned_quantity=dec.get("final_planned_quantity"),
            override_reason=dec.get("override_reason"),
            status=dec.get("status", "ACCEPTED"),
            updated_at=str(dec.get("updated_at", "")),
        )

    async def save_decision(
        self, meal_id: str, planned_quantity: int, override_reason: Optional[str] = None
    ) -> VendorDecisionSchema:
        rec = await self.get_recommendation(meal_id)
        is_override = (rec.recommended_portions is not None and planned_quantity != rec.recommended_portions)
        now_iso = datetime.now(timezone.utc).isoformat()

        dec_doc = {
            "original_recommendation": rec.recommended_portions,
            "final_planned_quantity": planned_quantity,
            "override_reason": override_reason if is_override else None,
            "status": "OVERRIDDEN" if is_override else "ACCEPTED",
            "updated_at": now_iso,
        }

        await self.collection.update_one(
            {"_id": meal_id},
            {"$set": {"vendor_decision": dec_doc}},
        )

        return VendorDecisionSchema(
            meal_instance_id=meal_id,
            original_recommendation=dec_doc["original_recommendation"],
            final_planned_quantity=dec_doc["final_planned_quantity"],
            override_reason=dec_doc["override_reason"],
            status=dec_doc["status"],
            updated_at=dec_doc["updated_at"],
        )
