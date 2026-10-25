from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, col, select

from ..analysis.trend import LOW_QUALITY_SCORE, MIN_FIT_SESSIONS, Exclusion, Trend, TrendStatus, exclusion, fit_trend
from ..db import get_session
from ..models import TestSession, User
from ..security import current_user

router = APIRouter(prefix="/trends", tags=["trends"])


class TrendOut(BaseModel):
    status: TrendStatus
    n: int
    needed: int
    slope_per_month: float | None
    fitted_change: float | None
    first_fitted: float | None
    last_fitted: float | None
    span_days: float | None


class TrendPoint(BaseModel):
    session_id: int
    started_at: datetime
    reps: int
    raw_reps: int
    cdc_threshold: int | None  # can step down when the user moves into an older age band
    quality_score: float | None  # None for sessions recorded before quality scores
    mean_stand_s: float | None
    fatigue_index: float | None
    mean_sway: float | None
    in_fit: bool
    excluded_reason: Exclusion | None  # plot these points greyed out


class TrendsOut(BaseModel):
    min_sessions: int
    low_quality_below: int
    points: list[TrendPoint]  # oldest first
    reps: TrendOut
    mean_stand_s: TrendOut
    fatigue_index: TrendOut
    mean_sway: TrendOut


def _get(d: dict[str, Any], *path: str) -> float | None:
    for key in path:
        if not isinstance(d, dict):
            return None
        d = d.get(key)
    return float(d) if isinstance(d, (int, float)) else None


def _out(t: Trend) -> TrendOut:
    return TrendOut(**t.__dict__)


@router.get("", response_model=TrendsOut)
def get_trends(user: User = Depends(current_user), db: Session = Depends(get_session)):
    rows = db.exec(
        select(TestSession).where(TestSession.user_id == user.id).order_by(col(TestSession.started_at))
    ).all()

    points: list[TrendPoint] = []
    for s in rows:
        quality = _get(s.metrics, "quality_score")
        reason = exclusion(s.valid, s.used_arms, quality)
        points.append(
            TrendPoint(
                session_id=s.id,
                started_at=s.started_at,
                reps=s.reps,
                raw_reps=s.raw_reps,
                cdc_threshold=s.cdc_threshold,
                quality_score=quality,
                mean_stand_s=_get(s.metrics, "speed", "mean_s"),
                fatigue_index=_get(s.metrics, "fatigue", "index"),
                mean_sway=_get(s.metrics, "steadiness", "mean_sway"),
                in_fit=reason is None,
                excluded_reason=reason,
            )
        )

    fit = [p for p in points if p.in_fit]

    def trend(metric: str) -> TrendOut:
        values = [(p.started_at, getattr(p, metric)) for p in fit]
        return _out(fit_trend([(t, float(v)) for t, v in values if v is not None], metric))

    return TrendsOut(
        min_sessions=MIN_FIT_SESSIONS,
        low_quality_below=LOW_QUALITY_SCORE,
        points=points,
        reps=trend("reps"),
        mean_stand_s=trend("mean_stand_s"),
        fatigue_index=trend("fatigue_index"),
        mean_sway=trend("mean_sway"),
    )
