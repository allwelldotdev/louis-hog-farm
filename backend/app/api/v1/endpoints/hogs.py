from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_hog_in_farm
from app.api.deps import CurrentUser, MutatorUser, is_manager_like
from app.api.pagination import PageParams, paginate
from app.core.time import utc_now
from app.db.session import get_db
from app.models.hog import Hog, HogSex, HogStatus, ProductionClass
from app.models.user import UserRole
from app.schemas.dashboard import GrowthPoint, GrowthSeriesResponse
from app.schemas.hog import HogCreate, HogRead, HogUpdate
from app.schemas.pagination import Page
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


@router.get("", response_model=Page[HogRead])
def list_hogs(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    page: PageParams,
    status_filter: HogStatus | None = Query(default=None, alias="status"),
    breed: str | None = None,
    production_class: ProductionClass | None = None,
) -> Page[HogRead]:
    stmt = select(Hog).where(Hog.farm_id == user.farm_id).order_by(Hog.id)
    if status_filter is not None:
        stmt = stmt.where(Hog.status == status_filter)
    if breed is not None:
        stmt = stmt.where(Hog.breed == breed)
    if production_class is not None:
        stmt = stmt.where(Hog.production_class == production_class)
    return paginate(db, stmt, page, HogRead)


def _validate_lineage(
    db: Session,
    farm_id: int,
    dam_id: int | None,
    sire_id: int | None,
    birth_date: date,
    child_id: int | None = None,
) -> None:
    """Check lineage ids before they are stored.

    Ids come from the client, so each is resolved rather than trusted: an
    unchecked dam_id is a hog id from another farm waiting to be linked. Beyond
    ownership, three rules keep a pedigree coherent — a dam is female, a sire is
    male, and no animal is its own parent or younger than one. The database
    cannot enforce any of them: dam_id and sire_id are plain self-FKs, not
    composite with farm_id, so this is the only place they are checked.
    """
    for parent_id, expected_sex, role in (
        (dam_id, HogSex.female, "dam"),
        (sire_id, HogSex.male, "sire"),
    ):
        if parent_id is None:
            continue
        if parent_id == child_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A hog cannot be its own {role}",
            )
        parent = get_hog_in_farm(db, parent_id, farm_id)
        if parent.sex is not expected_sex:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The {role} must be a {expected_sex.value} hog",
            )
        if parent.birth_date >= birth_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The {role} must be born before the hog itself",
            )


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
    _validate_lineage(db, user.farm_id, body.dam_id, body.sire_id, body.birth_date)
    hog = Hog(
        farm_id=user.farm_id,
        tag_number=body.tag_number,
        birth_date=body.birth_date,
        breed=body.breed,
        sex=body.sex,
        production_class=body.production_class,
        dam_id=body.dam_id,
        sire_id=body.sire_id,
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
    # Lineage is the one pair of fields that has to distinguish "leave it alone"
    # from "clear it" — a dam recorded in error is corrected by removing her, and
    # `is not None` cannot express that. `model_fields_set` can: it holds the keys
    # the client actually sent, so an explicit null clears and an absent key does
    # not. The other fields have no meaningful null and stay as they are.
    new_dam_id = body.dam_id if "dam_id" in body.model_fields_set else hog.dam_id
    new_sire_id = body.sire_id if "sire_id" in body.model_fields_set else hog.sire_id
    new_birth_date = body.birth_date if body.birth_date is not None else hog.birth_date
    _validate_lineage(db, user.farm_id, new_dam_id, new_sire_id, new_birth_date, child_id=hog.id)
    if body.tag_number is not None:
        hog.tag_number = body.tag_number
    if body.birth_date is not None:
        hog.birth_date = body.birth_date
    if body.breed is not None:
        hog.breed = body.breed
    if body.status is not None:
        hog.status = body.status
    if body.sex is not None:
        hog.sex = body.sex
    if body.production_class is not None:
        hog.production_class = body.production_class
    hog.dam_id = new_dam_id
    hog.sire_id = new_sire_id
    hog.updated_by_user_id = user.id
    hog.updated_at = utc_now()
    db.add(hog)
    db.commit()
    db.refresh(hog)
    return hog
