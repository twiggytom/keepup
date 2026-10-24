from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session

from ..db import get_session
from ..models import Profile, Sex, User
from ..norms import age_on
from ..security import current_user

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileIn(BaseModel):
    name: str = ""
    birth_date: date
    sex: Sex
    health_notes: str = ""
    caregiver_email: EmailStr | None = None
    test_interval_days: int = Field(default=30, ge=7, le=365)


class ProfileOut(ProfileIn):
    age: int


def _out(profile: Profile) -> ProfileOut:
    return ProfileOut(**profile.model_dump(exclude={"user_id"}), age=age_on(profile.birth_date, date.today()))


@router.get("", response_model=ProfileOut)
def get_profile(user: User = Depends(current_user), db: Session = Depends(get_session)):
    profile = db.get(Profile, user.id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not set up yet")
    return _out(profile)


@router.put("", response_model=ProfileOut)
def put_profile(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    if body.birth_date >= date.today():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Birth date must be in the past")
    profile = db.get(Profile, user.id) or Profile(user_id=user.id, **body.model_dump())
    for key, value in body.model_dump().items():
        setattr(profile, key, value)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _out(profile)
