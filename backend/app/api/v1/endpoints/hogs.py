from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_hog_in_farm
from app.api.deps import CurrentUser, MutatorUser, is_manager_like
from app.db.session import get_db
from app.models.hog import Hog, HogStatus
from app.models.user import UserRole
from app.schemas.dashboard import GrowthPoint, GrowthSeriesResponse
from app.schemas.hog import HogCreate, HogRead, HogUpdate
from app.services.dashboard_metrics import fetch_growth_series_for_hog

router = APIRouter(prefix="/hogs", tags=["hogs"])


def _active_tag_taken(
    db: Session, farm_id: int, tag: str, exclude_hog_id: int | None = None
) -> bool:
    stmt = select(Hog.id).where(
        Hog.farm_id == farm_id,
        Hog.tag_number == tag,
        Hog.status == HogStatus.active,
    )
    if exclude_hog_id is not None:
        stmt = stmt.where(Hog.id != exclude_hog_id)
    return db.scalar(stmt) is not None


@router.get("", response_model=list[HogRead])
def list_hogs(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    status_filter: HogStatus | None = Query(default=None, alias="status"),
) -> list[Hog]:
    stmt = select(Hog).where(Hog.farm_id == user.farm_id).order_by(Hog.id)
    if status_filter is not None:
        stmt = stmt.where(Hog.status == status_filter)
    return list(db.scalars(stmt).all())


@router.post("", response_model=HogRead, status_code=status.HTTP_201_CREATED)
def create_hog(
    db: Annotated[Session, Depends(get_db)],
    user: MutatorUser,
    body: HogCreate,
) -> Hog:
    if _active_tag_taken(db, user.farm_id, body.tag_number):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active hog with this tag number already exists on the farm",
        )
    hog = Hog(
        farm_id=user.farm_id,
        tag_number=body.tag_number,
        birth_date=body.birth_date,
        breed=body.breed,
        status=HogStatus.active,
        created_by_user_id=user.id,
        updated_by_user_id=user.id,
    )
    db.add(hog)
    db.commit()
    db.refresh(hog)
    return hog


@router.get("/{hog_id}/growth", response_model=GrowthSeriesResponse)
def hog_growth_series(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    hog_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
) -> GrowthSeriesResponse:
    get_hog_in_farm(db, hog_id, user.farm_id)
    series = fetch_growth_series_for_hog(db, user.farm_id, hog_id, date_from, date_to)
    return GrowthSeriesResponse(
        hog_id=hog_id,
        date_from=date_from,
        date_to=date_to,
        actual=[GrowthPoint(date=d, weight_kg=float(w)) for d, w in series],
        forecast=[],
    )


@router.get("/{hog_id}", response_model=HogRead)
def get_hog(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    hog_id: int,
) -> Hog:
    return get_hog_in_farm(db, hog_id, user.farm_id)


@router.patch("/{hog_id}", response_model=HogRead)
def update_hog(
    db: Annotated[Session, Depends(get_db)],
    user: MutatorUser,
    hog_id: int,
    body: HogUpdate,
) -> Hog:
    hog = get_hog_in_farm(db, hog_id, user.farm_id)
    if body.status == HogStatus.archived and user.role == UserRole.worker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only a manager can archive a hog"
        )
    if body.status == HogStatus.active and hog.status == HogStatus.archived:
        if not is_manager_like(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Only a manager can restore a hog"
            )
    new_tag = body.tag_number if body.tag_number is not None else hog.tag_number
    new_status = body.status if body.status is not None else hog.status
    if new_status == HogStatus.active and _active_tag_taken(
        db, user.farm_id, new_tag, exclude_hog_id=hog.id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active hog with this tag number already exists on the farm",
        )
    if body.tag_number is not None:
        hog.tag_number = body.tag_number
    if body.birth_date is not None:
        hog.birth_date = body.birth_date
    if body.breed is not None:
        hog.breed = body.breed
    if body.status is not None:
        hog.status = body.status
    hog.updated_by_user_id = user.id
    hog.updated_at = datetime.now(UTC)
    db.add(hog)
    db.commit()
    db.refresh(hog)
    return hog
