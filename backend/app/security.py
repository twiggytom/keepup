from datetime import timedelta

from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlmodel import Session

from .config import settings
from .db import get_session
from .models import User, utcnow

COOKIE_NAME = "keepup_token"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_token(user_id: int) -> str:
    expire = utcnow() + timedelta(days=settings.jwt_expire_days)
    return jwt.encode({"sub": str(user_id), "exp": expire}, settings.jwt_secret, settings.jwt_algorithm)


def current_user(
    token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_session),
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    if not token:
        raise unauthorized
    try:
        user_id = int(jwt.decode(token, settings.jwt_secret, [settings.jwt_algorithm])["sub"])
    except (JWTError, KeyError, ValueError):
        raise unauthorized
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user
