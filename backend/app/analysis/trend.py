"""Trends across a user's test history.

A least-squares line is fitted through the sessions that count toward a trend, and the
change along that line is compared with a noise band, so normal test-to-test variation
reads as "steady" rather than as improvement or decline.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum

MIN_FIT_SESSIONS = 3
LOW_QUALITY_SCORE = 70  # sessions scoring below this are plotted but left out of the fit
DAYS_PER_MONTH = 30.44

# Smallest fitted change treated as real, per metric. Stands: individual minimal detectable
# change for the 30-second chair stand is about 2.5-3.3 stands in published studies. The
# movement-metric bands are provisional (no published values) and should be tuned.
NOISE = {
    "reps": 3.0,
    "mean_stand_s": 0.3,
    "fatigue_index": 0.15,
    "mean_sway": 0.03,
}
# Whether a higher value is better for each metric.
HIGHER_IS_BETTER = {"reps": True, "mean_stand_s": False, "fatigue_index": False, "mean_sway": False}


class TrendStatus(str, Enum):
    insufficient_data = "insufficient_data"
    improving = "improving"
    steady = "steady"
    declining = "declining"


class Exclusion(str, Enum):
    not_counted = "not_counted"  # out of frame too long
    low_quality = "low_quality"
    arms_used = "arms_used"  # scored 0 under STEADI, not comparable to standard trials


@dataclass(frozen=True)
class Trend:
    status: TrendStatus
    n: int  # sessions in the fit
    needed: int  # more sessions needed before a trend is shown
    slope_per_month: float | None
    fitted_change: float | None  # along the fitted line, first to last session
    first_fitted: float | None
    last_fitted: float | None
    span_days: float | None


def exclusion(valid: bool, used_arms: bool, quality_score: float | None) -> Exclusion | None:
    """Why a session is left out of trend fits, or None if it counts.

    Sessions recorded before quality scores existed have no score and are not penalised.
    """
    if not valid:
        return Exclusion.not_counted
    if used_arms:
        return Exclusion.arms_used
    if quality_score is not None and quality_score < LOW_QUALITY_SCORE:
        return Exclusion.low_quality
    return None


def fit_trend(points: list[tuple[datetime, float]], metric: str) -> Trend:
    """Fit a line through (time, value) points that already passed `exclusion`."""
    n = len(points)
    if n < MIN_FIT_SESSIONS:
        return Trend(TrendStatus.insufficient_data, n, MIN_FIT_SESSIONS - n, None, None, None, None, None)

    points = sorted(points)
    t0 = points[0][0]
    xs = [(t - t0).total_seconds() / 86400 for t, _ in points]
    ys = [v for _, v in points]
    mx, my = sum(xs) / n, sum(ys) / n
    var = sum((x - mx) ** 2 for x in xs)
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / var if var else 0.0
    first, last = my + slope * (xs[0] - mx), my + slope * (xs[-1] - mx)
    change = last - first

    if abs(change) < NOISE[metric]:
        status = TrendStatus.steady
    else:
        better = change > 0 if HIGHER_IS_BETTER[metric] else change < 0
        status = TrendStatus.improving if better else TrendStatus.declining

    return Trend(
        status=status,
        n=n,
        needed=0,
        slope_per_month=round(slope * DAYS_PER_MONTH, 3) if var else None,
        fitted_change=round(change, 3),
        first_fitted=round(first, 3),
        last_fitted=round(last, 3),
        span_days=round(xs[-1], 1),
    )
