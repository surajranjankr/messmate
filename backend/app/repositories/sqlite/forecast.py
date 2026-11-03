"""
MessMate SQLite Forecast Repository Implementation
==================================================
Dynamic demand forecasting engine based on actual student population,
recorded responses, historical attendance rate, and safety margin.
"""

import math
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.models.forecast import ForecastRecommendation, VendorDecision
from app.models.meal import MealInstance
from app.models.response import MealResponse
from app.models.outcome import MealOutcome
from app.models.user import User
from app.models.setting import InstitutionSetting
from app.schemas.forecast import ForecastRecommendationSchema, VendorDecisionSchema
from app.core.config import settings
from app.repositories.forecast import IForecastRepository


class SqliteForecastRepository(IForecastRepository):
    def __init__(self, db: Session):
        self.db = db

    def _calculate_historical_rate(
        self, meal_instance_id: str, meal_type: Optional[str], eligible_ids: set
    ) -> Optional[float]:
        """
        Derives historical nonresponse attendance rate from completed meals with recorded outcomes.
        Prioritizes the same meal type if available.
        """
        past_query = (
            self.db.query(MealOutcome, MealInstance)
            .join(MealInstance, MealOutcome.meal_instance_id == MealInstance.id)
            .filter(
                MealOutcome.actual_attendance.isnot(None),
                MealInstance.id != meal_instance_id,
            )
        )
        if meal_type:
            same_type = past_query.filter(MealInstance.meal_type == meal_type).all()
            pairs = same_type if same_type else past_query.all()
        else:
            pairs = past_query.all()

        if not pairs:
            return None

        total_attended_nonresp = 0.0
        total_nonresp = 0
        T = len(eligible_ids)

        for outcome, pm in pairs:
            p_responses = (
                self.db.query(MealResponse)
                .filter(
                    MealResponse.meal_instance_id == pm.id,
                    MealResponse.student_id.in_(eligible_ids),
                )
                .all()
            )
            p_unique = {r.student_id: r.choice for r in p_responses}
            p_D = sum(1 for c in p_unique.values() if c == "DEFINITELY_EATING")
            p_P = sum(1 for c in p_unique.values() if c == "PROBABLY_EATING")
            p_N = sum(1 for c in p_unique.values() if c == "NOT_EATING")
            p_R = max(0, T - (p_D + p_P + p_N))

            if p_R > 0:
                resp_demand = (p_D * 1.0) + (p_P * 0.5)
                attended_nonresp = max(0.0, min(float(p_R), float(outcome.actual_attendance) - resp_demand))
                total_attended_nonresp += attended_nonresp
                total_nonresp += p_R

        if total_nonresp > 0:
            return round(max(0.0, min(1.0, total_attended_nonresp / total_nonresp)), 2)
        return None

    async def get_recommendation(
        self, meal_id: str
    ) -> ForecastRecommendationSchema:
        meal = self.db.query(MealInstance).filter(MealInstance.id == meal_id).first()
        if not meal:
            raise KeyError(f"Meal instance {meal_id} not found.")

        # 1. Total active eligible students
        eligible_students = (
            self.db.query(User.id)
            .filter(User.role == "STUDENT", User.status == "ACTIVE")
            .all()
        )
        eligible_ids = {r[0] for r in eligible_students}
        T = len(eligible_ids)

        # 2. Meal response counts
        if T == 0:
            D, P, N, R = 0, 0, 0, 0
        else:
            responses = (
                self.db.query(MealResponse)
                .filter(
                    MealResponse.meal_instance_id == meal_id,
                    MealResponse.student_id.in_(eligible_ids),
                )
                .all()
            )
            unique_responses = {r.student_id: r.choice for r in responses}
            D = sum(1 for c in unique_responses.values() if c == "DEFINITELY_EATING")
            P = sum(1 for c in unique_responses.values() if c == "PROBABLY_EATING")
            N = sum(1 for c in unique_responses.values() if c == "NOT_EATING")
            R = max(0, T - (D + P + N))

        # 3. Nonresponse attendance rate determination
        rate = None
        rate_source = None
        if T > 0 and R > 0:
            hist_rate = self._calculate_historical_rate(meal_id, meal.meal_type, eligible_ids)
            if hist_rate is not None:
                rate = hist_rate
                rate_source = "HISTORICAL"
            elif settings.DEFAULT_NONRESPONSE_ATTENDANCE_RATE is not None:
                rate = float(settings.DEFAULT_NONRESPONSE_ATTENDANCE_RATE)
                rate_source = "CONFIGURED_FALLBACK"

        # 4. Expected demand and recommended portions calculation
        inst_setting = self.db.query(InstitutionSetting).filter(InstitutionSetting.id == "default").first()
        m = float(inst_setting.safety_margin_fraction) if inst_setting else settings.DEFAULT_SAFETY_MARGIN
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

        # 5. Persist or update recommendation in database
        rec = self.db.query(ForecastRecommendation).filter(ForecastRecommendation.meal_instance_id == meal_id).first()
        now = datetime.now(timezone.utc)
        if rec:
            rec.baseline_attendance = T
            rec.expected_attendance = F
            rec.safety_margin_fraction = m
            rec.recommended_portions = Q
            rec.forecast_method = method
            rec.data_quality_status = status
            rec.explanation = explanation
        else:
            rec = ForecastRecommendation(
                meal_instance_id=meal_id,
                baseline_attendance=T,
                expected_attendance=F,
                safety_margin_fraction=m,
                recommended_portions=Q,
                forecast_method=method,
                data_quality_status=status,
                explanation=explanation,
                created_at=now,
            )
            self.db.add(rec)
        self.db.commit()
        self.db.refresh(rec)

        return ForecastRecommendationSchema(
            meal_instance_id=rec.meal_instance_id,
            baseline_attendance=rec.baseline_attendance,
            expected_attendance=rec.expected_attendance,
            safety_margin_fraction=rec.safety_margin_fraction,
            recommended_portions=rec.recommended_portions,
            forecast_method=rec.forecast_method,
            data_quality_status=rec.data_quality_status,
            explanation=rec.explanation,
            definitely_eating=D,
            probably_eating=P,
            not_eating=N,
            no_response=R,
            nonresponse_attendance_rate=rate,
        )

    async def get_decision(
        self, meal_id: str
    ) -> Optional[VendorDecisionSchema]:
        decision = self.db.query(VendorDecision).filter(VendorDecision.meal_instance_id == meal_id).first()
        if not decision:
            return None
        return VendorDecisionSchema(
            meal_instance_id=decision.meal_instance_id,
            original_recommendation=decision.original_recommendation,
            final_planned_quantity=decision.final_planned_quantity,
            override_reason=decision.override_reason,
            status=decision.status,
            updated_at=decision.updated_at.isoformat() if hasattr(decision.updated_at, "isoformat") else str(decision.updated_at),
        )

    async def save_decision(
        self, meal_id: str, planned_quantity: int, override_reason: Optional[str] = None
    ) -> VendorDecisionSchema:
        rec = await self.get_recommendation(meal_id)
        is_override = (rec.recommended_portions is not None and planned_quantity != rec.recommended_portions)

        decision = self.db.query(VendorDecision).filter(VendorDecision.meal_instance_id == meal_id).first()
        now = datetime.now(timezone.utc)

        if decision:
            decision.final_planned_quantity = planned_quantity
            decision.override_reason = override_reason if is_override else None
            decision.status = "OVERRIDDEN" if is_override else "ACCEPTED"
            decision.updated_at = now
        else:
            decision = VendorDecision(
                meal_instance_id=meal_id,
                original_recommendation=rec.recommended_portions,
                final_planned_quantity=planned_quantity,
                override_reason=override_reason if is_override else None,
                status="OVERRIDDEN" if is_override else "ACCEPTED",
                updated_at=now,
            )
            self.db.add(decision)

        self.db.commit()
        self.db.refresh(decision)

        return VendorDecisionSchema(
            meal_instance_id=decision.meal_instance_id,
            original_recommendation=decision.original_recommendation,
            final_planned_quantity=decision.final_planned_quantity,
            override_reason=decision.override_reason,
            status=decision.status,
            updated_at=decision.updated_at.isoformat() if hasattr(decision.updated_at, "isoformat") else str(decision.updated_at),
        )
