from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, select

from ..config import settings
from ..db import get_session
from ..models import User
from ..security import COOKIE_NAME, create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserOut(BaseModel):
    id: int
    email: str


def _set_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_token(user_id),
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=settings.jwt_expire_days * 86400,
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(creds: Credentials, response: Response, db: Session = Depends(get_session)):
    email = creds.email.lower()
    if db.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=email, password_hash=hash_password(creds.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_cookie(response, user.id)
    return UserOut(id=user.id, email=user.email)


@router.post("/login", response_model=UserOut)
def login(creds: Credentials, response: Response, db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.email == creds.email.lower())).first()
    if user is None or not verify_password(creds.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect")
    _set_cookie(response, user.id)
    return UserOut(id=user.id, email=user.email)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return UserOut(id=user.id, email=user.email)
