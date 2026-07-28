"""Dashboard KPI and time-series helpers (M2)."""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.feed_record import FeedRecord
from app.models.health_record import HealthRecord
from app.models.hog import Hog, HogStatus


@dataclass(frozen=True)
class HogWeightSeriesPoint:
    hog_id: int
    tag_number: str
    breed: str
    record_date: date
    weight_kg: Decimal


@dataclass(frozen=True)
class HogAdgRow:
    hog_id: int
    tag_number: str
    breed: str
    adg_kg_per_day: float
    weight_gain_kg: float
    days: int


def _hog_query(farm_id: int, breed: str | None, statuses: Iterable[HogStatus] | None = None):
    stmt = select(Hog).where(Hog.farm_id == farm_id)
    if breed:
        stmt = stmt.where(Hog.breed == breed)
    if statuses is not None:
        stmt = stmt.where(Hog.status.in_(list(statuses)))
    return stmt


def fetch_health_points_in_range(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    breed: str | None,
) -> list[HogWeightSeriesPoint]:
    stmt = (
        select(HealthRecord.hog_id, Hog.tag_number, Hog.breed, HealthRecord.record_date, HealthRecord.weight)
        .join(Hog, HealthRecord.hog_id == Hog.id)
        .where(
            Hog.farm_id == farm_id,
            HealthRecord.record_date >= date_from,
            HealthRecord.record_date <= date_to,
        )
        .order_by(HealthRecord.hog_id, HealthRecord.record_date, HealthRecord.id)
    )
    if breed:
        stmt = stmt.where(Hog.breed == breed)
    rows = db.execute(stmt).all()
    return [
        HogWeightSeriesPoint(
            hog_id=r[0],
            tag_number=r[1],
            breed=r[2],
            record_date=r[3],
            weight_kg=Decimal(str(r[4])),
        )
        for r in rows
    ]


def count_health_records_in_range(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    breed: str | None,
) -> int:
    stmt = (
        select(func.count(HealthRecord.id))
        .join(Hog, HealthRecord.hog_id == Hog.id)
        .where(
            Hog.farm_id == farm_id,
            HealthRecord.record_date >= date_from,
            HealthRecord.record_date <= date_to,
        )
    )
    if breed:
        stmt = stmt.where(Hog.breed == breed)
    return int(db.scalar(stmt) or 0)


def count_feed_records_in_range(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    breed: str | None,
) -> int:
    stmt = (
        select(func.count(FeedRecord.id))
        .join(Hog, FeedRecord.hog_id == Hog.id)
        .where(
            Hog.farm_id == farm_id,
            FeedRecord.record_date >= date_from,
            FeedRecord.record_date <= date_to,
        )
    )
    if breed:
        stmt = stmt.where(Hog.breed == breed)
    return int(db.scalar(stmt) or 0)


def compute_adg_rows(points: list[HogWeightSeriesPoint]) -> list[HogAdgRow]:
    by_hog: dict[int, list[HogWeightSeriesPoint]] = defaultdict(list)
    meta: dict[int, tuple[str, str]] = {}
    for p in points:
        by_hog[p.hog_id].append(p)
        meta[p.hog_id] = (p.tag_number, p.breed)
    out: list[HogAdgRow] = []
    for hog_id, series in by_hog.items():
        if len(series) < 2:
            continue
        first, last = series[0], series[-1]
        days = (last.record_date - first.record_date).days
        if days <= 0:
            continue
        gain = float(last.weight_kg - first.weight_kg)
        adg = gain / days
        tag, br = meta[hog_id]
        out.append(
            HogAdgRow(
                hog_id=hog_id,
                tag_number=tag,
                breed=br,
                adg_kg_per_day=adg,
                weight_gain_kg=gain,
                days=days,
            )
        )
    return out


def total_feed_cost_in_range(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    breed: str | None,
) -> tuple[Decimal, dict[str, Decimal]]:
    stmt = (
        select(func.coalesce(func.sum(FeedRecord.feed_cost), 0), FeedRecord.currency_code)
        .join(Hog, FeedRecord.hog_id == Hog.id)
        .where(
            Hog.farm_id == farm_id,
            FeedRecord.record_date >= date_from,
            FeedRecord.record_date <= date_to,
        )
        .group_by(FeedRecord.currency_code)
    )
    if breed:
        stmt = stmt.where(Hog.breed == breed)
    rows = db.execute(stmt).all()
    totals: dict[str, Decimal] = {}
    grand = Decimal("0")
    for total, code in rows:
        totals[code] = Decimal(str(total))
        grand += Decimal(str(total))
    return grand, totals


def total_weight_gain_kg(adg_rows: list[HogAdgRow]) -> float:
    return sum(r.weight_gain_kg for r in adg_rows)


def market_ready_stats(
    db: Session,
    farm_id: int,
    date_to: date,
    breed: str | None,
    market_weight_kg: float,
) -> tuple[int, int]:
    """Returns (ready_count, active_hogs_count)."""
    hogs = list(db.scalars(_hog_query(farm_id, breed, statuses=(HogStatus.active,))).all())
    if not hogs:
        return 0, 0
    hog_ids = [h.id for h in hogs]
    stmt = (
        select(HealthRecord.hog_id, HealthRecord.record_date, HealthRecord.weight)
        .where(HealthRecord.hog_id.in_(hog_ids), HealthRecord.record_date <= date_to)
        .order_by(HealthRecord.hog_id, HealthRecord.record_date.desc(), HealthRecord.id.desc())
    )
    rows = db.execute(stmt).all()
    latest: dict[int, Decimal] = {}
    for hog_id, _d, w in rows:
        if hog_id not in latest:
            latest[hog_id] = Decimal(str(w))
    ready = sum(1 for hid in hog_ids if latest.get(hid, Decimal("0")) >= Decimal(str(market_weight_kg)))
    return ready, len(hog_ids)


def fetch_growth_series_for_hog(
    db: Session,
    farm_id: int,
    hog_id: int,
    date_from: date | None,
    date_to: date | None,
) -> list[tuple[date, Decimal]]:
    stmt = (
        select(HealthRecord.record_date, HealthRecord.weight)
        .join(Hog, HealthRecord.hog_id == Hog.id)
        .where(Hog.farm_id == farm_id, HealthRecord.hog_id == hog_id)
        .order_by(HealthRecord.record_date, HealthRecord.id)
    )
    if date_from is not None:
        stmt = stmt.where(HealthRecord.record_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(HealthRecord.record_date <= date_to)
    return [(r[0], Decimal(str(r[1]))) for r in db.execute(stmt).all()]
