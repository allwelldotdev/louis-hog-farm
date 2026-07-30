from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_hog_in_farm
from app.api.deps import CurrentUser, MutatorUser
from app.api.pagination import PageParams, paginate
from app.core.time import farm_today, utc_now
from app.db.session import get_db
from app.models.health_record import HealthRecord
from app.schemas.health import HealthRecordCreate, HealthRecordRead, HealthRecordUpdate
from app.schemas.pagination import Page

router = APIRouter(prefix="/health-records", tags=["health-records"])


def _assert_record_date_not_future(d: date, timezone: str) -> None:
    if d > farm_today(timezone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="record_date cannot be in the future"
        )


@router.get("", response_model=Page[HealthRecordRead])
def list_health_records(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    page: PageParams,
    hog_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Page[HealthRecordRead]:
    stmt = select(HealthRecord).where(HealthRecord.farm_id == user.farm_id)
    if hog_id is not None:
        get_hog_in_farm(db, hog_id, user.farm_id)
        stmt = stmt.where(HealthRecord.hog_id == hog_id)
    if date_from is not None:
        stmt = stmt.where(HealthRecord.record_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(HealthRecord.record_date <= date_to)
    stmt = stmt.order_by(HealthRecord.record_date.desc(), HealthRecord.id.desc())
    return paginate(db, stmt, page, HealthRecordRead)


@router.post("", response_model=HealthRecordRead, status_code=status.HTTP_201_CREATED)
def create_health_record(
    db: Annotated[Session, Depends(get_db)],
    user: MutatorUser,
    body: HealthRecordCreate,
) -> HealthRecord:
    get_hog_in_farm(db, body.hog_id, user.farm_id)
    _assert_record_date_not_future(body.record_date, user.farm.timezone)
    rec = HealthRecord(
        hog_id=body.hog_id,
        farm_id=user.farm_id,
        weight=body.weight,
        temperature=body.temperature,
        notes=body.notes,
        record_date=body.record_date,
        created_by_user_id=user.id,
        updated_by_user_id=user.id,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.get("/{record_id}", response_model=HealthRecordRead)
def get_health_record(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    record_id: int,
) -> HealthRecord:
    rec = db.get(HealthRecord, record_id)
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health record not found")
    get_hog_in_farm(db, rec.hog_id, user.farm_id)
    return rec


@router.patch("/{record_id}", response_model=HealthRecordRead)
def update_health_record(
    db: Annotated[Session, Depends(get_db)],
    user: MutatorUser,
    record_id: int,
    body: HealthRecordUpdate,
) -> HealthRecord:
    rec = db.get(HealthRecord, record_id)
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health record not found")
    get_hog_in_farm(db, rec.hog_id, user.farm_id)
    if body.record_date is not None:
        _assert_record_date_not_future(body.record_date, user.farm.timezone)
        rec.record_date = body.record_date
    if body.weight is not None:
        rec.weight = body.weight
    if body.temperature is not None:
        rec.temperature = body.temperature
    if body.notes is not None:
        rec.notes = body.notes
    rec.updated_by_user_id = user.id
    rec.updated_at = utc_now()
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec
