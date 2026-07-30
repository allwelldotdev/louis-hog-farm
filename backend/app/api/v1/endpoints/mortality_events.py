from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_hog_in_farm
from app.api.deps import CurrentUser, ManagerUser
from app.api.pagination import PageParams, paginate
from app.core.time import farm_today, utc_now
from app.db.session import get_db
from app.models.hog import HogStatus
from app.models.mortality_event import MortalityEvent
from app.schemas.mortality import MortalityEventCreate, MortalityEventRead
from app.schemas.pagination import Page

router = APIRouter(prefix="/mortality-events", tags=["mortality-events"])


@router.get("", response_model=Page[MortalityEventRead])
def list_mortality_events(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    page: PageParams,
    hog_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Page[MortalityEventRead]:
    stmt = select(MortalityEvent).where(MortalityEvent.farm_id == user.farm_id)
    if hog_id is not None:
        get_hog_in_farm(db, hog_id, user.farm_id)
        stmt = stmt.where(MortalityEvent.hog_id == hog_id)
    if date_from is not None:
        stmt = stmt.where(MortalityEvent.event_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(MortalityEvent.event_date <= date_to)
    stmt = stmt.order_by(MortalityEvent.event_date.desc(), MortalityEvent.id.desc())
    return paginate(db, stmt, page, MortalityEventRead)


@router.post("", response_model=MortalityEventRead, status_code=status.HTTP_201_CREATED)
def create_mortality_event(
    db: Annotated[Session, Depends(get_db)],
    user: ManagerUser,
    body: MortalityEventCreate,
) -> MortalityEvent:
    """Record a death, and move the hog to `deceased` in the same transaction.

    The two go together by definition. Leaving the status to a separate PATCH
    would let a farm accumulate deaths whose animals still count as live herd,
    which is exactly how the mortality rate becomes wrong. Manager-only: this is
    the one hog transition that cannot be undone by re-editing a field.
    """
    hog = get_hog_in_farm(db, body.hog_id, user.farm_id)
    if body.event_date > farm_today(user.farm.timezone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="event_date cannot be in the future"
        )
    existing = db.scalar(select(MortalityEvent).where(MortalityEvent.hog_id == body.hog_id))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Hog {hog.tag_number} already has a recorded death",
        )
    event = MortalityEvent(
        hog_id=body.hog_id,
        farm_id=user.farm_id,
        event_date=body.event_date,
        cause=body.cause,
        notes=body.notes,
        created_by_user_id=user.id,
        updated_by_user_id=user.id,
    )
    hog.status = HogStatus.deceased
    hog.updated_by_user_id = user.id
    hog.updated_at = utc_now()
    db.add_all([event, hog])
    db.commit()
    db.refresh(event)
    return event
