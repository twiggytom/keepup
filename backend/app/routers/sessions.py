from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, col, select

from ..db import get_session
from ..models import Profile, RepEvent, Sex, TestSession, User
from ..norms import age_on, cdc_norm
from ..security import current_user

router = APIRouter(prefix="/sessions", tags=["sessions"])

# A session is invalid if the person was out of frame for longer than this in total.
MAX_OUT_OF_FRAME_S = 3.0


class RepEventIn(BaseModel):
    index: int
    t_sit_start: float
    t_stand_peak: float
    t_sit_end: float | None = None
    duration_s: float | None = None
    partial: bool = False


class SessionIn(BaseModel):
    started_at: datetime
    raw_reps: int = Field(ge=0, le=60)
    used_arms: bool = False
    quality_flags: dict[str, Any] = {}
    metrics: dict[str, Any] = {}
    rep_events: list[RepEventIn] = []


class SessionOut(BaseModel):
    id: int
    started_at: datetime
    age_at_test: int
    sex: Sex
    raw_reps: int
    reps: int
    used_arms: bool
    valid: bool
    cdc_threshold: int | None
    cdc_band: str
    norm_applicable: bool
    below_threshold: bool | None
    quality_flags: dict[str, Any]
    metrics: dict[str, Any]
    rep_events: list[RepEventIn] = []


def _out(s: TestSession, events: list[RepEvent] | None = None) -> SessionOut:
    norm = cdc_norm(s.age_at_test, s.sex)
    return SessionOut(
        **s.model_dump(exclude={"user_id", "created_at"}),
        cdc_band=norm.band,
        norm_applicable=norm.applicable,
        rep_events=[RepEventIn(**e.model_dump(exclude={"id", "session_id"})) for e in events or []],
    )


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(body: SessionIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    profile = db.get(Profile, user.id)
    if profile is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Set up your profile before taking a test")

    age = age_on(profile.birth_date, body.started_at.date())
    norm = cdc_norm(age, profile.sex)
    reps = 0 if body.used_arms else body.raw_reps  # STEADI: using arms scores 0
    valid = float(body.quality_flags.get("out_of_frame_s", 0)) <= MAX_OUT_OF_FRAME_S

    session = TestSession(
        user_id=user.id,
        started_at=body.started_at,
        age_at_test=age,
        sex=profile.sex,
        raw_reps=body.raw_reps,
        reps=reps,
        used_arms=body.used_arms,
        valid=valid,
        cdc_threshold=norm.threshold if norm.applicable else None,
        below_threshold=(reps < norm.threshold) if norm.applicable and valid else None,
        quality_flags=body.quality_flags,
        metrics=body.metrics,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    db.add_all(RepEvent(session_id=session.id, **e.model_dump()) for e in body.rep_events)
    db.commit()
    db.refresh(session)
    out = _out(session)
    out.rep_events = body.rep_events
    return out


@router.get("", response_model=list[SessionOut])
def list_sessions(user: User = Depends(current_user), db: Session = Depends(get_session)):
    rows = db.exec(
        select(TestSession).where(TestSession.user_id == user.id).order_by(col(TestSession.started_at).desc())
    ).all()
    return [_out(s) for s in rows]


@router.get("/{session_id}", response_model=SessionOut)
def get_session_detail(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_session)):
    s = db.get(TestSession, session_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    events = db.exec(select(RepEvent).where(RepEvent.session_id == s.id).order_by(col(RepEvent.index))).all()
    return _out(s, list(events))
