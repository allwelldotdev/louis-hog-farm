from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_alert_rule_in_farm, get_hog_in_farm
from app.api.deps import CurrentUser, ManagerUser
from app.core.time import utc_now
from app.db.session import get_db
from app.models.alert import Alert, AlertStatus, AlertType
from app.models.hog import Hog
from app.schemas.alert import AlertCreate, AlertRead, AlertUpdate

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertRead])
def list_alerts(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    hog_id: int | None = None,
    status_filter: AlertStatus | None = Query(default=None, alias="status"),
    alert_type: AlertType | None = None,
) -> list[Alert]:
    stmt = select(Alert).join(Hog, Alert.hog_id == Hog.id).where(Hog.farm_id == user.farm_id)
    if hog_id is not None:
        get_hog_in_farm(db, hog_id, user.farm_id)
        stmt = stmt.where(Alert.hog_id == hog_id)
    if status_filter is not None:
        stmt = stmt.where(Alert.status == status_filter)
    if alert_type is not None:
        stmt = stmt.where(Alert.alert_type == alert_type)
    stmt = stmt.order_by(Alert.alert_date.desc(), Alert.id.desc())
    return list(db.scalars(stmt).all())


@router.post("", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
def create_alert(
    db: Annotated[Session, Depends(get_db)],
    user: ManagerUser,
    body: AlertCreate,
) -> Alert:
    get_hog_in_farm(db, body.hog_id, user.farm_id)
    if body.alert_rule_id is not None:
        get_alert_rule_in_farm(db, body.alert_rule_id, user.farm_id)
    alert = Alert(
        hog_id=body.hog_id,
        alert_rule_id=body.alert_rule_id,
        alert_type=body.alert_type,
        alert_date=body.alert_date,
        message=body.message,
        status=AlertStatus.open,
        created_by_user_id=user.id,
        updated_by_user_id=user.id,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.get("/{alert_id}", response_model=AlertRead)
def get_alert(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    alert_id: int,
) -> Alert:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    get_hog_in_farm(db, alert.hog_id, user.farm_id)
    return alert


@router.patch("/{alert_id}", response_model=AlertRead)
def update_alert(
    db: Annotated[Session, Depends(get_db)],
    user: ManagerUser,
    alert_id: int,
    body: AlertUpdate,
) -> Alert:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    get_hog_in_farm(db, alert.hog_id, user.farm_id)
    if body.status is not None:
        alert.status = body.status
    if body.resolution_notes is not None:
        alert.resolution_notes = body.resolution_notes
    alert.updated_by_user_id = user.id
    alert.updated_at = utc_now()
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert
