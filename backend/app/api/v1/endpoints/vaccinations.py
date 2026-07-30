from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_hog_in_farm
from app.api.deps import CurrentUser, MutatorUser
from app.api.pagination import PageParams, paginate
from app.core.time import farm_today
from app.db.session import get_db
from app.models.vaccination import Vaccination
from app.schemas.pagination import Page
from app.schemas.vaccination import VaccinationCreate, VaccinationRead

router = APIRouter(prefix="/vaccinations", tags=["vaccinations"])


@router.get("", response_model=Page[VaccinationRead])
def list_vaccinations(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    page: PageParams,
    hog_id: int | None = None,
    due_before: date | None = None,
) -> Page[VaccinationRead]:
    """Doses given, newest first. `due_before` narrows to the ones falling due."""
    stmt = select(Vaccination).where(Vaccination.farm_id == user.farm_id)
    if hog_id is not None:
        get_hog_in_farm(db, hog_id, user.farm_id)
        stmt = stmt.where(Vaccination.hog_id == hog_id)
    if due_before is not None:
        stmt = stmt.where(
            Vaccination.next_due_date.is_not(None), Vaccination.next_due_date <= due_before
        )
    stmt = stmt.order_by(Vaccination.dose_date.desc(), Vaccination.id.desc())
    return paginate(db, stmt, page, VaccinationRead)


@router.post("", response_model=VaccinationRead, status_code=status.HTTP_201_CREATED)
def create_vaccination(
    db: Annotated[Session, Depends(get_db)],
    user: MutatorUser,
    body: VaccinationCreate,
) -> Vaccination:
    get_hog_in_farm(db, body.hog_id, user.farm_id)
    if body.dose_date > farm_today(user.farm.timezone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="dose_date cannot be in the future"
        )
    if body.next_due_date is not None and body.next_due_date < body.dose_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="next_due_date must be on or after dose_date",
        )
    vaccination = Vaccination(
        hog_id=body.hog_id,
        farm_id=user.farm_id,
        vaccine_name=body.vaccine_name,
        dose_date=body.dose_date,
        next_due_date=body.next_due_date,
        notes=body.notes,
        created_by_user_id=user.id,
        updated_by_user_id=user.id,
    )
    db.add(vaccination)
    db.commit()
    db.refresh(vaccination)
    return vaccination
