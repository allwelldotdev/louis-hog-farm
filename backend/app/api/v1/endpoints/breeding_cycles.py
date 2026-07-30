from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_hog_in_farm
from app.api.deps import CurrentUser, ManagerUser
from app.core.time import utc_now, utc_today
from app.db.session import get_db
from app.models.breeding_cycle import BreedingCycle, BreedingStatus
from app.models.hog import Hog
from app.schemas.breeding import BreedingCycleCreate, BreedingCycleRead, BreedingCycleUpdate

router = APIRouter(prefix="/breeding-cycles", tags=["breeding-cycles"])


def _assert_not_future(d: date) -> None:
    if d > utc_today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Date cannot be in the future"
        )


def _validate_cycle_dates(start: date, end: date | None, new_status: BreedingStatus) -> None:
    # Named new_status, not status: shadowing fastapi.status here made both raise
    # paths below throw AttributeError instead of returning 400 (audit c).
    if new_status in (BreedingStatus.completed, BreedingStatus.aborted) and end is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date is required when status is completed or aborted",
        )
    if end is not None and end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be on or after start_date",
        )


@router.get("", response_model=list[BreedingCycleRead])
def list_breeding_cycles(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    hog_id: int | None = None,
) -> list[BreedingCycle]:
    stmt = (
        select(BreedingCycle)
        .join(Hog, BreedingCycle.hog_id == Hog.id)
        .where(Hog.farm_id == user.farm_id)
    )
    if hog_id is not None:
        get_hog_in_farm(db, hog_id, user.farm_id)
        stmt = stmt.where(BreedingCycle.hog_id == hog_id)
    stmt = stmt.order_by(BreedingCycle.start_date.desc(), BreedingCycle.id.desc())
    return list(db.scalars(stmt).all())


@router.post("", response_model=BreedingCycleRead, status_code=status.HTTP_201_CREATED)
def create_breeding_cycle(
    db: Annotated[Session, Depends(get_db)],
    user: ManagerUser,
    body: BreedingCycleCreate,
) -> BreedingCycle:
    get_hog_in_farm(db, body.hog_id, user.farm_id)
    _assert_not_future(body.start_date)
    cycle = BreedingCycle(
        hog_id=body.hog_id,
        start_date=body.start_date,
        status=BreedingStatus.ongoing,
        notes=body.notes,
        created_by_user_id=user.id,
        updated_by_user_id=user.id,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


@router.get("/{cycle_id}", response_model=BreedingCycleRead)
def get_breeding_cycle(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    cycle_id: int,
) -> BreedingCycle:
    cycle = db.get(BreedingCycle, cycle_id)
    if cycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Breeding cycle not found"
        )
    get_hog_in_farm(db, cycle.hog_id, user.farm_id)
    return cycle


@router.patch("/{cycle_id}", response_model=BreedingCycleRead)
def update_breeding_cycle(
    db: Annotated[Session, Depends(get_db)],
    user: ManagerUser,
    cycle_id: int,
    body: BreedingCycleUpdate,
) -> BreedingCycle:
    cycle = db.get(BreedingCycle, cycle_id)
    if cycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Breeding cycle not found"
        )
    get_hog_in_farm(db, cycle.hog_id, user.farm_id)

    if body.start_date is not None:
        _assert_not_future(body.start_date)
    if body.end_date is not None:
        _assert_not_future(body.end_date)

    if cycle.status != BreedingStatus.ongoing:
        if body.start_date is not None or body.end_date is not None or body.status is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only notes can be updated after a breeding cycle is closed",
            )
        if body.notes is not None:
            cycle.notes = body.notes
            cycle.updated_by_user_id = user.id
            cycle.updated_at = utc_now()
            db.add(cycle)
            db.commit()
            db.refresh(cycle)
        return cycle

    start = body.start_date if body.start_date is not None else cycle.start_date
    end = body.end_date if body.end_date is not None else cycle.end_date
    new_status = body.status if body.status is not None else cycle.status

    if body.status is not None and body.status != cycle.status:
        if body.status not in (BreedingStatus.completed, BreedingStatus.aborted):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status transition"
            )

    _validate_cycle_dates(start, end, new_status)

    if body.start_date is not None:
        cycle.start_date = body.start_date
    if body.end_date is not None:
        cycle.end_date = body.end_date
    if body.status is not None:
        cycle.status = body.status
    if body.notes is not None:
        cycle.notes = body.notes

    cycle.updated_by_user_id = user.id
    cycle.updated_at = utc_now()
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle
