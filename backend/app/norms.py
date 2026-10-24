"""CDC STEADI 30-Second Chair Stand norms.

Source: CDC STEADI "Assessment: 30-Second Chair Stand" (2017), adapted from
Rikli RE, Jones CJ. Development and validation of criterion-referenced clinically
relevant fitness standards for maintaining physical independence in later years.
Gerontologist. 2013;53(2):255-267.

A score *below* the listed value is "below average" and indicates a risk for falls.
"""

from dataclasses import dataclass
from datetime import date

from .models import Sex

# (min_age, max_age, men, women)
_BANDS: list[tuple[int, int, int, int]] = [
    (60, 64, 14, 12),
    (65, 69, 12, 11),
    (70, 74, 12, 10),
    (75, 79, 11, 10),
    (80, 84, 10, 9),
    (85, 89, 8, 8),
    (90, 94, 7, 4),
]
MIN_AGE = _BANDS[0][0]
MAX_AGE = _BANDS[-1][1]


@dataclass(frozen=True)
class NormResult:
    threshold: int
    band: str
    applicable: bool  # False when age is outside the validated 60-94 range


def age_on(birth_date: date, on: date) -> int:
    had_birthday = (on.month, on.day) >= (birth_date.month, birth_date.day)
    return on.year - birth_date.year - (0 if had_birthday else 1)


def cdc_norm(age: int, sex: Sex) -> NormResult:
    """Threshold for an age/sex. Outside 60-94 the nearest band is returned for display only."""
    clamped = min(max(age, MIN_AGE), MAX_AGE)
    for lo, hi, men, women in _BANDS:
        if lo <= clamped <= hi:
            return NormResult(
                threshold=men if sex == Sex.male else women,
                band=f"{lo}-{hi}",
                applicable=MIN_AGE <= age <= MAX_AGE,
            )
    raise AssertionError("unreachable")
