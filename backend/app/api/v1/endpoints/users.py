from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_user_in_farm
from app.api.deps import CurrentUser, ManagerUser, is_manager_like
from app.api.pagination import PageParams, paginate
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.pagination import Page
from app.schemas.user import UserCreateStaff, UserRead, UserRoleUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=Page[UserRead])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    manager: ManagerUser,
    page: PageParams,
) -> Page[UserRead]:
    """Staff on the signed-in user's farm. Manager-only.

    Scoped to `manager.farm_id`, not to every user: the roster is farm data like
    any other, and a worker has no business enumerating their colleagues'
    accounts.
    """
    stmt = select(User).where(User.farm_id == manager.farm_id).order_by(User.id)
    return paginate(db, stmt, page, UserRead)


@router.get("/me", response_model=UserRead)
def read_me(current_user: CurrentUser) -> User:
    return current_user


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_staff_user(
    db: Annotated[Session, Depends(get_db)],
    manager: ManagerUser,
    body: UserCreateStaff,
) -> User:
    existing = db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        farm_id=manager.farm_id,
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_staff_role(
    db: Annotated[Session, Depends(get_db)],
    manager: ManagerUser,
    user_id: int,
    body: UserRoleUpdate,
) -> User:
    """Move a colleague between worker and viewer. Manager-only, farm-scoped.

    Two guards, both about not being able to lock a farm out of its own
    settings. Nothing in this application can promote anyone to manager — not
    registration, which always creates a new farm, and not `POST /users`, whose
    schema refuses the role. So a manager who could demote themselves, or each
    other, would leave the farm with no one able to administer it and no way
    back short of editing the database.
    """
    target = get_user_in_farm(db, user_id, manager.farm_id)
    if target.id == manager.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own role"
        )
    if is_manager_like(target):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A manager's role cannot be changed from the app",
        )
    target.role = body.role
    db.add(target)
    db.commit()
    db.refresh(target)
    return target
