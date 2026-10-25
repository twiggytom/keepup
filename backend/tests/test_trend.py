from datetime import datetime, timedelta

from app.analysis.trend import Exclusion, TrendStatus, exclusion, fit_trend

T0 = datetime(2026, 1, 1)


def series(values, every_days=14):
    return [(T0 + timedelta(days=i * every_days), v) for i, v in enumerate(values)]


def test_needs_three_sessions():
    t = fit_trend(series([12, 11]), "reps")
    assert (t.status, t.n, t.needed) == (TrendStatus.insufficient_data, 2, 1)


def test_flat_and_noisy_is_steady():
    assert fit_trend(series([12, 12, 12, 12]), "reps").status == TrendStatus.steady
    # Swings of 2 stands are within normal test-to-test variation.
    assert fit_trend(series([12, 14, 11, 13, 12]), "reps").status == TrendStatus.steady


def test_declining_and_improving_reps():
    down = fit_trend(series([14, 13, 12, 11, 10]), "reps")
    assert down.status == TrendStatus.declining
    assert down.fitted_change == -4
    assert down.slope_per_month < 0
    assert fit_trend(series([9, 10, 12, 13]), "reps").status == TrendStatus.improving


def test_lower_is_better_for_stand_time():
    assert fit_trend(series([2.2, 2.4, 2.6, 2.8]), "mean_stand_s").status == TrendStatus.declining
    assert fit_trend(series([2.8, 2.6, 2.4, 2.2]), "mean_stand_s").status == TrendStatus.improving


def test_same_day_sessions_have_no_slope():
    t = fit_trend([(T0, 12), (T0, 13), (T0, 11)], "reps")
    assert t.status == TrendStatus.steady
    assert t.slope_per_month is None


def test_fit_sorts_by_time():
    pts = series([14, 13, 12, 11, 10])
    assert fit_trend(list(reversed(pts)), "reps").status == TrendStatus.declining


def test_exclusion_rules():
    assert exclusion(valid=True, used_arms=False, quality_score=92) is None
    assert exclusion(valid=True, used_arms=False, quality_score=None) is None
    assert exclusion(valid=True, used_arms=False, quality_score=69) == Exclusion.low_quality
    assert exclusion(valid=True, used_arms=True, quality_score=95) == Exclusion.arms_used
    assert exclusion(valid=False, used_arms=False, quality_score=95) == Exclusion.not_counted
