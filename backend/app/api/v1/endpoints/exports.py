import csv
import io
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import Select, and_, or_, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import SessionLocal, get_db
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

# Rows are flushed to the client in batches rather than one write per row.
CHUNK_ROWS = 500


@dataclass(frozen=True)
class ExportSpec:
    """A column-only query plus how to render each row.

    Deliberately not `select(Model)`: hydrating full ORM objects to read a
    handful of scalars off them is pure overhead on an export path, and the
    identity map would retain every row for the life of the session.
    """

    header: list[str]
    stmt: Select[Any]
    format_row: Callable[[Any], list[str]]


def _utc_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=UTC)


def _utc_end(d: date) -> datetime:
    return datetime.combine(d, time.max, tzinfo=UTC)


def _flat(value: str | None) -> str:
    """Collapse newlines so a free-text field cannot break the CSV row."""
    return "" if value is None else value.replace("\n", " ").replace("\r", " ")


def _opt(value: Any) -> str:
    return "" if value is None else str(value)


def _spec_hogs(farm_id: int, date_from: date | None, date_to: date | None) -> ExportSpec:
    stmt = (
        select(
            Hog.id,
            Hog.farm_id,
            Hog.tag_number,
            Hog.birth_date,
            Hog.breed,
            Hog.sex,
            Hog.production_class,
            Hog.status,
            Hog.dam_id,
            Hog.sire_id,
            Hog.created_at,
            Hog.updated_at,
        )
        .where(Hog.farm_id == farm_id)
        .order_by(Hog.id)
    )
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
        "sex",
        "production_class",
        "status",
        "dam_id",
        "sire_id",
        "created_at",
        "updated_at",
    ]
    return ExportSpec(
        header=header,
        stmt=stmt,
        format_row=lambda r: [
            str(r[0]),
            str(r[1]),
            r[2],
            r[3].isoformat(),
            r[4],
            r[5].value,
            r[6].value,
            r[7].value,
            _opt(r[8]),
            _opt(r[9]),
            r[10].isoformat(),
            r[11].isoformat(),
        ],
    )


def _spec_users(farm_id: int, date_from: date | None, date_to: date | None) -> ExportSpec:
    stmt = (
        select(
            User.id,
            User.farm_id,
            User.email,
            User.full_name,
            User.role,
            User.is_active,
            User.created_at,
        )
        .where(User.farm_id == farm_id)
        .order_by(User.id)
    )
    if date_from is not None:
        stmt = stmt.where(User.created_at >= _utc_start(date_from))
    if date_to is not None:
        stmt = stmt.where(User.created_at <= _utc_end(date_to))
    return ExportSpec(
        header=["id", "farm_id", "email", "full_name", "role", "is_active", "created_at"],
        stmt=stmt,
        format_row=lambda r: [
            str(r[0]),
            str(r[1]),
            r[2],
            r[3],
            r[4].value,
            "1" if r[5] else "0",
            r[6].isoformat(),
        ],
    )


def _spec_feed_records(farm_id: int, date_from: date | None, date_to: date | None) -> ExportSpec:
    stmt = (
        select(
            FeedRecord.id,
            FeedRecord.hog_id,
            FeedRecord.feed_amount,
            FeedRecord.feed_cost,
            FeedRecord.currency_code,
            FeedRecord.record_date,
            FeedRecord.created_at,
        )
        .where(FeedRecord.farm_id == farm_id)
        .order_by(FeedRecord.record_date, FeedRecord.id)
    )
    if date_from is not None:
        stmt = stmt.where(FeedRecord.record_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(FeedRecord.record_date <= date_to)
    return ExportSpec(
        header=[
            "id",
            "hog_id",
            "feed_amount",
            "feed_cost",
            "currency_code",
            "record_date",
            "created_at",
        ],
        stmt=stmt,
        format_row=lambda r: [
            str(r[0]),
            str(r[1]),
            str(r[2]),
            str(r[3]),
            r[4],
            r[5].isoformat(),
            r[6].isoformat(),
        ],
    )


def _spec_health_records(farm_id: int, date_from: date | None, date_to: date | None) -> ExportSpec:
    stmt = (
        select(
            HealthRecord.id,
            HealthRecord.hog_id,
            HealthRecord.weight,
            HealthRecord.temperature,
            HealthRecord.notes,
            HealthRecord.record_date,
            HealthRecord.created_at,
        )
        .where(HealthRecord.farm_id == farm_id)
        .order_by(HealthRecord.record_date, HealthRecord.id)
    )
    if date_from is not None:
        stmt = stmt.where(HealthRecord.record_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(HealthRecord.record_date <= date_to)
    return ExportSpec(
        header=[
            "id",
            "hog_id",
            "weight",
            "temperature",
            "notes",
            "record_date",
            "created_at",
        ],
        stmt=stmt,
        format_row=lambda r: [
            str(r[0]),
            str(r[1]),
            str(r[2]),
            _opt(r[3]),
            _flat(r[4]),
            r[5].isoformat(),
            r[6].isoformat(),
        ],
    )


def _spec_breeding_cycles(farm_id: int, date_from: date | None, date_to: date | None) -> ExportSpec:
    stmt = (
        select(
            BreedingCycle.id,
            BreedingCycle.hog_id,
            BreedingCycle.start_date,
            BreedingCycle.end_date,
            BreedingCycle.status,
            BreedingCycle.notes,
            BreedingCycle.created_at,
        )
        .where(BreedingCycle.farm_id == farm_id)
        .order_by(BreedingCycle.start_date, BreedingCycle.id)
    )
    # A cycle matches the window if it *overlaps* it: an ongoing cycle has no
    # end_date and must still be reported.
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
    return ExportSpec(
        header=["id", "hog_id", "start_date", "end_date", "status", "notes", "created_at"],
        stmt=stmt,
        format_row=lambda r: [
            str(r[0]),
            str(r[1]),
            r[2].isoformat(),
            "" if r[3] is None else r[3].isoformat(),
            r[4].value,
            _flat(r[5]),
            r[6].isoformat(),
        ],
    )


def _spec_alerts(farm_id: int, date_from: date | None, date_to: date | None) -> ExportSpec:
    stmt = (
        select(
            Alert.id,
            Alert.hog_id,
            Alert.alert_rule_id,
            Alert.alert_type,
            Alert.alert_date,
            Alert.message,
            Alert.status,
            Alert.resolution_notes,
            Alert.created_at,
        )
        .where(Alert.farm_id == farm_id)
        .order_by(Alert.alert_date, Alert.id)
    )
    if date_from is not None:
        stmt = stmt.where(Alert.alert_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Alert.alert_date <= date_to)
    return ExportSpec(
        header=[
            "id",
            "hog_id",
            "alert_rule_id",
            "alert_type",
            "alert_date",
            "message",
            "status",
            "resolution_notes",
            "created_at",
        ],
        stmt=stmt,
        format_row=lambda r: [
            str(r[0]),
            str(r[1]),
            _opt(r[2]),
            r[3].value,
            r[4].isoformat(),
            _flat(r[5]),
            r[6].value,
            _flat(r[7]),
            r[8].isoformat(),
        ],
    )


def _spec_alert_rules(farm_id: int, date_from: date | None, date_to: date | None) -> ExportSpec:
    stmt = (
        select(
            AlertRule.id,
            AlertRule.farm_id,
            AlertRule.name,
            AlertRule.rule_type,
            AlertRule.config_json,
            AlertRule.is_active,
            AlertRule.created_at,
        )
        .where(AlertRule.farm_id == farm_id)
        .order_by(AlertRule.id)
    )
    if date_from is not None:
        stmt = stmt.where(AlertRule.created_at >= _utc_start(date_from))
    if date_to is not None:
        stmt = stmt.where(AlertRule.created_at <= _utc_end(date_to))
    return ExportSpec(
        header=["id", "farm_id", "name", "rule_type", "config_json", "is_active", "created_at"],
        stmt=stmt,
        format_row=lambda r: [
            str(r[0]),
            str(r[1]),
            r[2],
            r[3],
            _flat(r[4]),
            "1" if r[5] else "0",
            r[6].isoformat(),
        ],
    )


_EXPORTS: dict[str, Callable[[int, date | None, date | None], ExportSpec]] = {
    "hogs": _spec_hogs,
    "users": _spec_users,
    "feed_records": _spec_feed_records,
    "health_records": _spec_health_records,
    "breeding_cycles": _spec_breeding_cycles,
    "alerts": _spec_alerts,
    "alert_rules": _spec_alert_rules,
}


def _iter_csv(spec: ExportSpec) -> Iterator[str]:
    """Yield CSV text in batches, streaming rows out of the database.

    Opens its own session rather than borrowing the request-scoped one: a
    generator body runs as the response is streamed, by which point a
    dependency-managed session may already have been closed.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)

    def flush() -> str:
        out = buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        return out

    writer.writerow(spec.header)
    yield flush()

    with SessionLocal() as db:
        pending = 0
        for row in db.execute(spec.stmt).yield_per(CHUNK_ROWS):
            writer.writerow(spec.format_row(row))
            pending += 1
            if pending >= CHUNK_ROWS:
                yield flush()
                pending = 0
        if pending:
            yield flush()


@router.get("/{export_key}", response_class=StreamingResponse)
def export_csv(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    export_key: ExportKey,
    date_from: date | None = None,
    date_to: date | None = None,
) -> StreamingResponse:
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be on or before date_to",
        )
    # No unknown-key branch: the ExportKey Literal makes FastAPI reject anything
    # else with 422 before this body runs.
    spec = _EXPORTS[export_key](user.farm_id, date_from, date_to)
    return StreamingResponse(
        _iter_csv(spec),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{export_key}.csv"'},
    )
