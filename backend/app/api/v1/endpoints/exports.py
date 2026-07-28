import csv
import io
from datetime import date, datetime, time, timezone
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

def _utc_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def _utc_end(d: date) -> datetime:
    return datetime.combine(d, time.max, tzinfo=timezone.utc)


def _csv_response(filename: str, rows: list[list[str]], header: list[str]) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    content = buf.getvalue()
    return Response(
        content=content,
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

    if export_key == "hogs":
        stmt = select(Hog).where(Hog.farm_id == user.farm_id).order_by(Hog.id)
        if date_from is not None:
            stmt = stmt.where(Hog.created_at >= _utc_start(date_from))
        if date_to is not None:
            stmt = stmt.where(Hog.created_at <= _utc_end(date_to))
        hogs = list(db.scalars(stmt).all())
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
                "" if h.created_by_user_id is None else str(h.created_by_user_id),
                "" if h.updated_by_user_id is None else str(h.updated_by_user_id),
                h.created_at.isoformat(),
                h.updated_at.isoformat(),
            ]
            for h in hogs
        ]
        return _csv_response("hogs.csv", rows, header)

    if export_key == "users":
        stmt = select(User).where(User.farm_id == user.farm_id).order_by(User.id)
        if date_from is not None:
            stmt = stmt.where(User.created_at >= _utc_start(date_from))
        if date_to is not None:
            stmt = stmt.where(User.created_at <= _utc_end(date_to))
        users = list(db.scalars(stmt).all())
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
            for u in users
        ]
        return _csv_response("users.csv", rows, header)

    if export_key == "feed_records":
        stmt = (
            select(FeedRecord)
            .join(Hog, FeedRecord.hog_id == Hog.id)
            .where(Hog.farm_id == user.farm_id)
            .order_by(FeedRecord.record_date, FeedRecord.id)
        )
        if date_from is not None:
            stmt = stmt.where(FeedRecord.record_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(FeedRecord.record_date <= date_to)
        recs = list(db.scalars(stmt).all())
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
                "" if r.created_by_user_id is None else str(r.created_by_user_id),
                "" if r.updated_by_user_id is None else str(r.updated_by_user_id),
                r.created_at.isoformat(),
                r.updated_at.isoformat(),
            ]
            for r in recs
        ]
        return _csv_response("feed_records.csv", rows, header)

    if export_key == "health_records":
        stmt = (
            select(HealthRecord)
            .join(Hog, HealthRecord.hog_id == Hog.id)
            .where(Hog.farm_id == user.farm_id)
            .order_by(HealthRecord.record_date, HealthRecord.id)
        )
        if date_from is not None:
            stmt = stmt.where(HealthRecord.record_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(HealthRecord.record_date <= date_to)
        recs = list(db.scalars(stmt).all())
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
                "" if r.notes is None else r.notes.replace("\n", " ").replace("\r", " "),
                r.record_date.isoformat(),
                "" if r.created_by_user_id is None else str(r.created_by_user_id),
                "" if r.updated_by_user_id is None else str(r.updated_by_user_id),
                r.created_at.isoformat(),
                r.updated_at.isoformat(),
            ]
            for r in recs
        ]
        return _csv_response("health_records.csv", rows, header)

    if export_key == "breeding_cycles":
        stmt = (
            select(BreedingCycle)
            .join(Hog, BreedingCycle.hog_id == Hog.id)
            .where(Hog.farm_id == user.farm_id)
            .order_by(BreedingCycle.start_date, BreedingCycle.id)
        )
        if date_from is not None and date_to is not None:
            stmt = stmt.where(
                and_(
                    BreedingCycle.start_date <= date_to,
                    or_(BreedingCycle.end_date.is_(None), BreedingCycle.end_date >= date_from),
                )
            )
        elif date_from is not None:
            stmt = stmt.where(or_(BreedingCycle.end_date.is_(None), BreedingCycle.end_date >= date_from))
        elif date_to is not None:
            stmt = stmt.where(BreedingCycle.start_date <= date_to)
        recs = list(db.scalars(stmt).all())
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
                "" if r.notes is None else r.notes.replace("\n", " ").replace("\r", " "),
                "" if r.created_by_user_id is None else str(r.created_by_user_id),
                "" if r.updated_by_user_id is None else str(r.updated_by_user_id),
                r.created_at.isoformat(),
                r.updated_at.isoformat(),
            ]
            for r in recs
        ]
        return _csv_response("breeding_cycles.csv", rows, header)

    if export_key == "alerts":
        stmt = (
            select(Alert)
            .join(Hog, Alert.hog_id == Hog.id)
            .where(Hog.farm_id == user.farm_id)
            .order_by(Alert.alert_date, Alert.id)
        )
        if date_from is not None:
            stmt = stmt.where(Alert.alert_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(Alert.alert_date <= date_to)
        recs = list(db.scalars(stmt).all())
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
                "" if r.alert_rule_id is None else str(r.alert_rule_id),
                r.alert_type.value,
                r.alert_date.isoformat(),
                r.message.replace("\n", " ").replace("\r", " "),
                r.status.value,
                "" if r.resolution_notes is None else r.resolution_notes.replace("\n", " ").replace("\r", " "),
                "" if r.created_by_user_id is None else str(r.created_by_user_id),
                "" if r.updated_by_user_id is None else str(r.updated_by_user_id),
                r.created_at.isoformat(),
                r.updated_at.isoformat(),
            ]
            for r in recs
        ]
        return _csv_response("alerts.csv", rows, header)

    if export_key == "alert_rules":
        stmt = select(AlertRule).where(AlertRule.farm_id == user.farm_id).order_by(AlertRule.id)
        if date_from is not None:
            stmt = stmt.where(AlertRule.created_at >= _utc_start(date_from))
        if date_to is not None:
            stmt = stmt.where(AlertRule.created_at <= _utc_end(date_to))
        recs = list(db.scalars(stmt).all())
        header = ["id", "farm_id", "name", "rule_type", "config_json", "is_active", "created_at"]
        rows = [
            [
                str(r.id),
                str(r.farm_id),
                r.name,
                r.rule_type,
                "" if r.config_json is None else r.config_json.replace("\n", " ").replace("\r", " "),
                "1" if r.is_active else "0",
                r.created_at.isoformat(),
            ]
            for r in recs
        ]
        return _csv_response("alert_rules.csv", rows, header)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown export")
