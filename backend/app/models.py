from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Sex(str, Enum):
    male = "male"
    female = "female"


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)


class Profile(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    name: str = ""
    # Birth date (not age) is stored so age is always current at test time.
    birth_date: date
    sex: Sex
    health_notes: str = ""
    caregiver_email: str | None = None
    test_interval_days: int = 30


class TestSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    started_at: datetime
    created_at: datetime = Field(default_factory=utcnow)
    age_at_test: int
    sex: Sex
    raw_reps: int
    reps: int  # official score: 0 if arms were used, per STEADI
    used_arms: bool = False
    valid: bool = True
    cdc_threshold: int | None = None
    below_threshold: bool | None = None
    quality_flags: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    metrics: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class RepEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="testsession.id", index=True)
    index: int
    t_sit_start: float
    t_stand_peak: float
    t_sit_end: float | None = None
    duration_s: float | None = None
    partial: bool = False  # counted under the "more than halfway up at 30 s" rule
