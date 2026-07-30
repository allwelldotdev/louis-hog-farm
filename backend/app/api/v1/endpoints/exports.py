import csv
import io
from collections.abc import Callable, Iterable
from datetime import UTC, date, datetime, time
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.models.alert import Alert, AlertRule
from app.models.breeding_cycle import BreedingCycle
from app.models.feed_record import FeedRecord
from app.models.health_record import HealthRecord
from app.models.hog import Hog
from app.models.user import User

router = APIRouter(prefix="/exports", tags=["exports"])

ExportKey = Literal[
    "hogs",
    "users",
    "feed_records",
    "health_records",
    "breeding_cycles",
    "alerts",
    "alert_rules",
]

# Each builder owns its own query and row shaping, so the seven entity types no
# longer share one over-loaded local. Returning rows as an Iterable keeps the
# door open for generator-based streaming without changing the call site.
ExportBuilder = Callable[
    [Session, int, date | None, date | None],
    tuple[list[str], Iterable[list[str]]],
]


def _utc_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=UTC)


def _utc_end(d: date) -> datetime:
    return datetime.combine(d, time.max, tzinfo=UTC)


def _flat(value: str | None) -> str:
    """Collapse newlines so a free-text field can never break the CSV row."""
    if value is None:
        return ""
    return value.replace("\n", " ").replace("\r", " ")


def _opt(value: int | None) -> str:
    return "" if value is None else str(value)


def _build_hogs(
    db: Session, farm_id: int, date_from: date | None, date_to: date | None
) -> tuple[list[str], Iterable[list[str]]]:
    stmt = select(Hog).where(Hog.farm_id == farm_id).order_by(Hog.id)
    if date_from is not None:
        stmt = stmt.where(Hog.created_at >= _utc_start(date_from))
    if date_to is not None:
        stmt = stmt.where(Hog.created_at <= _utc_end(date_to))
    header = [
        "id",
        "farm_id",
        "tag_number",
        "birth_date",
        "breed",
        "status",
        "created_by_user_id",
        "updated_by_user_id",
        "created_at",
        "updated_at",
    ]
    rows = [
        [
            str(h.id),
            str(h.farm_id),
            h.tag_number,
            h.birth_date.isoformat(),
            h.breed,
            h.status.value,
            _opt(h.created_by_user_id),
            _opt(h.updated_by_user_id),
            h.created_at.isoformat(),
            h.updated_at.isoformat(),
        ]
        for h in db.scalars(stmt).all()
    ]
    return header, rows


def _build_users(
    db: Session, farm_id: int, date_from: date | None, date_to: date | None
) -> tuple[list[str], Iterable[list[str]]]:
    stmt = select(User).where(User.farm_id == farm_id).order_by(User.id)
    if date_from is not None:
        stmt = stmt.where(User.created_at >= _utc_start(date_from))
    if date_to is not None:
        stmt = stmt.where(User.created_at <= _utc_end(date_to))
    header = ["id", "farm_id", "email", "full_name", "role", "is_active", "created_at"]
    rows = [
        [
            str(u.id),
            str(u.farm_id),
            u.email,
            u.full_name,
            u.role.value,
            "1" if u.is_active else "0",
            u.created_at.isoformat(),
        ]
        for u in db.scalars(stmt).all()
    ]
    return header, rows


def _build_feed_records(
    db: Session, farm_id: int, date_from: date | None, date_to: date | None
) -> tuple[list[str], Iterable[list[str]]]:
    stmt = (
        select(FeedRecord)
        .join(Hog, FeedRecord.hog_id == Hog.id)
        .where(Hog.farm_id == farm_id)
        .order_by(FeedRecord.record_date, FeedRecord.id)
    )
    if date_from is not None:
        stmt = stmt.where(FeedRecord.record_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(FeedRecord.record_date <= date_to)
    header = [
        "id",
        "hog_id",
        "feed_amount",
        "feed_cost",
        "currency_code",
        "record_date",
        "created_by_user_id",
        "updated_by_user_id",
        "created_at",
        "updated_at",
    ]
    rows = [
        [
            str(r.id),
            str(r.hog_id),
            str(r.feed_amount),
            str(r.feed_cost),
            r.currency_code,
            r.record_date.isoformat(),
            _opt(r.created_by_user_id),
            _opt(r.updated_by_user_id),
            r.created_at.isoformat(),
            r.updated_at.isoformat(),
        ]
        for r in db.scalars(stmt).all()
    ]
    return header, rows


def _build_health_records(
    db: Session, farm_id: int, date_from: date | None, date_to: date | None
) -> tuple[list[str], Iterable[list[str]]]:
    stmt = (
        select(HealthRecord)
        .join(Hog, HealthRecord.hog_id == Hog.id)
        .where(Hog.farm_id == farm_id)
        .order_by(HealthRecord.record_date, HealthRecord.id)
    )
    if date_from is not None:
        stmt = stmt.where(HealthRecord.record_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(HealthRecord.record_date <= date_to)
    header = [
        "id",
        "hog_id",
        "weight",
        "temperature",
        "notes",
        "record_date",
        "created_by_user_id",
        "updated_by_user_id",
        "created_at",
        "updated_at",
    ]
    rows = [
        [
            str(r.id),
            str(r.hog_id),
            str(r.weight),
            "" if r.temperature is None else str(r.temperature),
            _flat(r.notes),
            r.record_date.isoformat(),
            _opt(r.created_by_user_id),
            _opt(r.updated_by_user_id),
            r.created_at.isoformat(),
            r.updated_at.isoformat(),
        ]
        for r in db.scalars(stmt).all()
    ]
    return header, rows


def _build_breeding_cycles(
    db: Session, farm_id: int, date_from: date | None, date_to: date | None
) -> tuple[list[str], Iterable[list[str]]]:
    stmt = (
        select(BreedingCycle)
        .join(Hog, BreedingCycle.hog_id == Hog.id)
        .where(Hog.farm_id == farm_id)
        .order_by(BreedingCycle.start_date, BreedingCycle.id)
    )
    # A cycle matches the window if it overlaps it, not if it starts inside it —
    # an ongoing cycle has no end_date and must still be reported.
    if date_from is not None and date_to is not None:
        stmt = stmt.where(
            and_(
                BreedingCycle.start_date <= date_to,
                or_(BreedingCycle.end_date.is_(None), BreedingCycle.end_date >= date_from),
            )
        )
    elif date_from is not None:
        stmt = stmt.where(
            or_(BreedingCycle.end_date.is_(None), BreedingCycle.end_date >= date_from)
        )
    elif date_to is not None:
        stmt = stmt.where(BreedingCycle.start_date <= date_to)
    header = [
        "id",
        "hog_id",
        "start_date",
        "end_date",
        "status",
        "notes",
        "created_by_user_id",
        "updated_by_user_id",
        "created_at",
        "updated_at",
    ]
    rows = [
        [
            str(r.id),
            str(r.hog_id),
            r.start_date.isoformat(),
            "" if r.end_date is None else r.end_date.isoformat(),
            r.status.value,
            _flat(r.notes),
            _opt(r.created_by_user_id),
            _opt(r.updated_by_user_id),
            r.created_at.isoformat(),
            r.updated_at.isoformat(),
        ]
        for r in db.scalars(stmt).all()
    ]
    return header, rows


def _build_alerts(
    db: Session, farm_id: int, date_from: date | None, date_to: date | None
) -> tuple[list[str], Iterable[list[str]]]:
    stmt = (
        select(Alert)
        .join(Hog, Alert.hog_id == Hog.id)
        .where(Hog.farm_id == farm_id)
        .order_by(Alert.alert_date, Alert.id)
    )
    if date_from is not None:
        stmt = stmt.where(Alert.alert_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Alert.alert_date <= date_to)
    header = [
        "id",
        "hog_id",
        "alert_rule_id",
        "alert_type",
        "alert_date",
        "message",
        "status",
        "resolution_notes",
        "created_by_user_id",
        "updated_by_user_id",
        "created_at",
        "updated_at",
    ]
    rows = [
        [
            str(r.id),
            str(r.hog_id),
            _opt(r.alert_rule_id),
            r.alert_type.value,
            r.alert_date.isoformat(),
            _flat(r.message),
            r.status.value,
            _flat(r.resolution_notes),
            _opt(r.created_by_user_id),
            _opt(r.updated_by_user_id),
            r.created_at.isoformat(),
            r.updated_at.isoformat(),
        ]
        for r in db.scalars(stmt).all()
    ]
    return header, rows


def _build_alert_rules(
    db: Session, farm_id: int, date_from: date | None, date_to: date | None
) -> tuple[list[str], Iterable[list[str]]]:
    stmt = select(AlertRule).where(AlertRule.farm_id == farm_id).order_by(AlertRule.id)
    if date_from is not None:
        stmt = stmt.where(AlertRule.created_at >= _utc_start(date_from))
    if date_to is not None:
        stmt = stmt.where(AlertRule.created_at <= _utc_end(date_to))
    header = ["id", "farm_id", "name", "rule_type", "config_json", "is_active", "created_at"]
    rows = [
        [
            str(r.id),
            str(r.farm_id),
            r.name,
            r.rule_type,
            _flat(r.config_json),
            "1" if r.is_active else "0",
            r.created_at.isoformat(),
        ]
        for r in db.scalars(stmt).all()
    ]
    return header, rows


_EXPORTS: dict[str, ExportBuilder] = {
    "hogs": _build_hogs,
    "users": _build_users,
    "feed_records": _build_feed_records,
    "health_records": _build_health_records,
    "breeding_cycles": _build_breeding_cycles,
    "alerts": _build_alerts,
    "alert_rules": _build_alert_rules,
}


def _csv_response(filename: str, header: list[str], rows: Iterable[list[str]]) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{export_key}")
def export_csv(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    export_key: ExportKey,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Response:
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be on or before date_to",
        )
    # No unknown-key branch: the ExportKey Literal makes FastAPI reject anything
    # else with a 422 before this body runs.
    header, rows = _EXPORTS[export_key](db, user.farm_id, date_from, date_to)
    return _csv_response(f"{export_key}.csv", header, rows)
