from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.farm import Farm
from app.models.user import User, UserRole
from app.schemas.token import RefreshRequest, Token
from app.schemas.user import UserRead, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(body: UserRegister, db: Annotated[Session, Depends(get_db)]) -> User:
    existing = db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    farm = Farm(name=body.farm_name)
    db.add(farm)
    db.flush()

    user = User(
        farm_id=farm.id,
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.manager,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    db: Annotated[Session, Depends(get_db)],
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    user = db.scalar(select(User).where(User.email == form.username))
    now = datetime.now(UTC)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )

    if user.locked_until and user.locked_until > now:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account temporarily locked"
        )

    if not verify_password(form.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
        db.add(user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")

    user.failed_login_attempts = 0
    user.locked_until = None
    db.add(user)
    db.commit()

    sub = str(user.id)
    return Token(
        access_token=create_access_token(sub, {"role": user.role.value, "farm_id": user.farm_id}),
        refresh_token=create_refresh_token(sub),
    )


@router.post("/refresh", response_model=Token)
def refresh_token(db: Annotated[Session, Depends(get_db)], body: RefreshRequest) -> Token:
    token = body.refresh_token
    payload = decode_token(token)
    if payload is None or payload.get("typ") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        ) from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    sub_str = str(user.id)
    return Token(
        access_token=create_access_token(
            sub_str, {"role": user.role.value, "farm_id": user.farm_id}
        ),
        refresh_token=create_refresh_token(sub_str),
    )
