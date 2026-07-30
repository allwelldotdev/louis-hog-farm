from datetime import UTC, date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_hog_in_farm
from app.api.deps import CurrentUser, MutatorUser, is_manager_like
from app.api.pagination import PageParams, paginate
from app.core.time import farm_today, utc_now
from app.db.session import get_db
from app.models.feed_record import FeedRecord
from app.models.user import User
from app.schemas.feed import FeedRecordCreate, FeedRecordRead, FeedRecordUpdate
from app.schemas.pagination import Page

router = APIRouter(prefix="/feed-records", tags=["feed-records"])

FEED_EDIT_GRACE = timedelta(hours=24)


def _assert_record_date_not_future(d: date, timezone: str) -> None:
    if d > farm_today(timezone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="record_date cannot be in the future"
        )


def _assert_can_edit_feed(user: User, rec: FeedRecord) -> None:
    created = rec.created_at
    if created is None:
        return
    if created.tzinfo is None:
        created = created.replace(tzinfo=UTC)
    if utc_now() - created <= FEED_EDIT_GRACE:
        return
    if is_manager_like(user):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Workers may edit feed records only within 24 hours of creation; ask a manager",
    )


@router.get("", response_model=Page[FeedRecordRead])
def list_feed_records(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    page: PageParams,
    hog_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Page[FeedRecordRead]:
    stmt = select(FeedRecord).where(FeedRecord.farm_id == user.farm_id)
    if hog_id is not None:
        get_hog_in_farm(db, hog_id, user.farm_id)
        stmt = stmt.where(FeedRecord.hog_id == hog_id)
    if date_from is not None:
        stmt = stmt.where(FeedRecord.record_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(FeedRecord.record_date <= date_to)
    stmt = stmt.order_by(FeedRecord.record_date.desc(), FeedRecord.id.desc())
    return paginate(db, stmt, page, FeedRecordRead)


@router.post("", response_model=FeedRecordRead, status_code=status.HTTP_201_CREATED)
def create_feed_record(
    db: Annotated[Session, Depends(get_db)],
    user: MutatorUser,
    body: FeedRecordCreate,
) -> FeedRecord:
    get_hog_in_farm(db, body.hog_id, user.farm_id)
    _assert_record_date_not_future(body.record_date, user.farm.timezone)
    rec = FeedRecord(
        hog_id=body.hog_id,
        farm_id=user.farm_id,
        feed_amount=body.feed_amount,
        feed_cost=body.feed_cost,
        # Taken from the farm, never from the request. Client-supplied currency
        # let one farm accumulate mixed currencies, which made the dashboard
        # blank out every cost KPI (audit i).
        currency_code=user.farm.currency_code,
        record_date=body.record_date,
        created_by_user_id=user.id,
        updated_by_user_id=user.id,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.get("/{record_id}", response_model=FeedRecordRead)
def get_feed_record(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    record_id: int,
) -> FeedRecord:
    rec = db.get(FeedRecord, record_id)
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed record not found")
    get_hog_in_farm(db, rec.hog_id, user.farm_id)
    return rec


@router.patch("/{record_id}", response_model=FeedRecordRead)
def update_feed_record(
    db: Annotated[Session, Depends(get_db)],
    user: MutatorUser,
    record_id: int,
    body: FeedRecordUpdate,
) -> FeedRecord:
    rec = db.get(FeedRecord, record_id)
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed record not found")
    get_hog_in_farm(db, rec.hog_id, user.farm_id)
    _assert_can_edit_feed(user, rec)
    if body.record_date is not None:
        _assert_record_date_not_future(body.record_date, user.farm.timezone)
        rec.record_date = body.record_date
    if body.feed_amount is not None:
        rec.feed_amount = body.feed_amount
    if body.feed_cost is not None:
        rec.feed_cost = body.feed_cost
    rec.updated_by_user_id = user.id
    rec.updated_at = utc_now()
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec
