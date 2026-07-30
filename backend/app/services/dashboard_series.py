"""Time-series and distribution queries behind the dashboard's charts.

Split from `dashboard_metrics` because these answer a different question: that
module reduces the herd to single figures, this one shapes it into the buckets a
chart plots. Everything here is farm-scoped through the denormalized `farm_id`,
so no query joins `hogs` unless a breed filter asks for it.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from sqlalchemy import ColumnElement, Date, Select, SQLColumnExpression, case, cast, func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert, AlertStatus, AlertType
from app.models.feed_record import FeedRecord
from app.models.health_record import HealthRecord
from app.models.hog import Hog, HogStatus

Interval = Literal["day", "week"]

# Never interpolated from the request. `date_trunc` takes its unit as a literal
# and this keeps the set of accepted values closed.
_TRUNC_UNIT: dict[str, str] = {"day": "day", "week": "week"}


def _bucket(interval: Interval, column: SQLColumnExpression[date]) -> ColumnElement[date]:
    return cast(func.date_trunc(_TRUNC_UNIT[interval], column), Date)


@dataclass(frozen=True)
class HerdGrowthPoint:
    bucket: date
    hog_count: int
    avg_weight_kg: float
    median_weight_kg: float
    p10_weight_kg: float
    p90_weight_kg: float


def herd_growth_series(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    breed: str | None,
    interval: Interval,
) -> list[HerdGrowthPoint]:
    """Weight distribution per bucket — the headline line-and-band chart.

    The percentile band matters more than the mean here: a herd whose mean is
    climbing while its 10th percentile is flat has a group of animals falling
    behind, and an average alone hides that completely.
    """
    bucket = _bucket(interval, HealthRecord.record_date)
    stmt = (
        select(
            bucket.label("bucket"),
            func.count(func.distinct(HealthRecord.hog_id)).label("hog_count"),
            func.avg(HealthRecord.weight).label("avg_w"),
            func.percentile_cont(0.5).within_group(HealthRecord.weight.asc()).label("median_w"),
            func.percentile_cont(0.1).within_group(HealthRecord.weight.asc()).label("p10_w"),
            func.percentile_cont(0.9).within_group(HealthRecord.weight.asc()).label("p90_w"),
        )
        .where(
            HealthRecord.farm_id == farm_id,
            HealthRecord.record_date >= date_from,
            HealthRecord.record_date <= date_to,
        )
        .group_by(bucket)
        .order_by(bucket)
    )
    if breed:
        stmt = stmt.join(Hog, HealthRecord.hog_id == Hog.id).where(Hog.breed == breed)
    return [
        HerdGrowthPoint(
            bucket=r.bucket,
            hog_count=int(r.hog_count),
            avg_weight_kg=float(r.avg_w),
            median_weight_kg=float(r.median_w),
            p10_weight_kg=float(r.p10_w),
            p90_weight_kg=float(r.p90_w),
        )
        for r in db.execute(stmt).all()
    ]


def latest_weight_per_hog_by_bucket(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    interval: Interval,
) -> list[tuple[date, int, float]]:
    """Each hog's last weigh-in within each bucket, as `(bucket, hog_id, kg)`."""
    bucket = _bucket(interval, HealthRecord.record_date)
    ranked = (
        select(
            bucket.label("bucket"),
            HealthRecord.hog_id,
            HealthRecord.weight,
            func.row_number()
            .over(
                partition_by=(bucket, HealthRecord.hog_id),
                order_by=(HealthRecord.record_date.desc(), HealthRecord.id.desc()),
            )
            .label("rn"),
        )
        .where(
            HealthRecord.farm_id == farm_id,
            HealthRecord.record_date >= date_from,
            HealthRecord.record_date <= date_to,
        )
        .subquery("ranked")
    )
    rows = db.execute(
        select(ranked.c.bucket, ranked.c.hog_id, ranked.c.weight).where(ranked.c.rn == 1)
    ).all()
    return [(r[0], int(r[1]), float(r[2])) for r in rows]


def compute_bucket_gains(rows: list[tuple[date, int, float]]) -> dict[date, float]:
    """Herd weight gained in each bucket. Pure — the unit-testable core.

    Only animals weighed in *both* the bucket and the one before it contribute.
    Summing total herd weight and taking the difference would be simpler and
    wrong: a hog sold or born between two buckets would register as tens of
    kilograms of gain or loss that no animal actually put on.
    """
    by_bucket: dict[date, dict[int, float]] = defaultdict(dict)
    for bucket, hog_id, weight in rows:
        by_bucket[bucket][hog_id] = weight

    gains: dict[date, float] = {}
    ordered = sorted(by_bucket)
    for previous, current in zip(ordered, ordered[1:], strict=False):
        before, after = by_bucket[previous], by_bucket[current]
        gains[current] = sum(after[h] - before[h] for h in after.keys() & before.keys())
    return gains


def feed_totals_by_bucket(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    interval: Interval,
) -> list[tuple[date, float, float]]:
    """`(bucket, feed_kg, feed_cost)` per bucket."""
    bucket = _bucket(interval, FeedRecord.record_date)
    rows = db.execute(
        select(
            bucket.label("bucket"),
            func.coalesce(func.sum(FeedRecord.feed_amount), 0),
            func.coalesce(func.sum(FeedRecord.feed_cost), 0),
        )
        .where(
            FeedRecord.farm_id == farm_id,
            FeedRecord.record_date >= date_from,
            FeedRecord.record_date <= date_to,
        )
        .group_by(bucket)
        .order_by(bucket)
    ).all()
    return [(r[0], float(r[1]), float(r[2])) for r in rows]


def _latest_weights(farm_id: int, date_to: date) -> Select[tuple[int, Decimal]]:
    """Newest weigh-in per hog on or before `date_to`, reduced in the database."""
    return (
        select(HealthRecord.hog_id, HealthRecord.weight)
        .where(HealthRecord.farm_id == farm_id, HealthRecord.record_date <= date_to)
        .order_by(HealthRecord.hog_id, HealthRecord.record_date.desc(), HealthRecord.id.desc())
        .distinct(HealthRecord.hog_id)
    )


@dataclass(frozen=True)
class GroupRow:
    key: str
    hog_count: int
    avg_weight_kg: float | None


def group_active_hogs(
    db: Session,
    farm_id: int,
    date_to: date,
    by: Literal["breed", "production_class"],
) -> list[GroupRow]:
    """Active herd composition by breed or production class, with mean weight.

    Doubles as the filter facet for the dashboard: the breed list the UI offers
    is exactly the breeds this returns, so there is no separate facets endpoint
    to keep in step.
    """
    latest = _latest_weights(farm_id, date_to).subquery("latest")
    column = Hog.breed if by == "breed" else Hog.production_class
    rows = db.execute(
        select(column, func.count(Hog.id), func.avg(latest.c.weight))
        .outerjoin(latest, latest.c.hog_id == Hog.id)
        .where(Hog.farm_id == farm_id, Hog.status == HogStatus.active)
        .group_by(column)
        .order_by(func.count(Hog.id).desc(), column)
    ).all()
    return [
        GroupRow(
            key=key.value if hasattr(key, "value") else str(key),
            hog_count=int(count),
            avg_weight_kg=float(avg_w) if avg_w is not None else None,
        )
        for key, count, avg_w in rows
    ]


@dataclass(frozen=True)
class WeightBucket:
    lower_kg: float
    upper_kg: float
    hog_count: int


def weight_histogram(
    db: Session,
    farm_id: int,
    date_to: date,
    breed: str | None,
    bucket_kg: float,
) -> list[WeightBucket]:
    """Latest weight per active hog, binned. Free once the weights are deduped."""
    latest = _latest_weights(farm_id, date_to).subquery("latest")
    lower = func.floor(latest.c.weight / bucket_kg) * bucket_kg
    stmt = (
        select(lower.label("lower"), func.count())
        .select_from(latest)
        .join(Hog, Hog.id == latest.c.hog_id)
        .where(Hog.farm_id == farm_id, Hog.status == HogStatus.active)
        .group_by(lower)
        .order_by(lower)
    )
    if breed:
        stmt = stmt.where(Hog.breed == breed)
    return [
        WeightBucket(
            lower_kg=float(lower_kg),
            upper_kg=float(lower_kg) + bucket_kg,
            hog_count=int(count),
        )
        for lower_kg, count in db.execute(stmt).all()
    ]


@dataclass(frozen=True)
class AlertSummary:
    by_status: dict[str, int]
    by_type: dict[str, int]
    recent: list[Alert]


def alert_summary(db: Session, farm_id: int, recent_limit: int = 5) -> AlertSummary:
    """Counts by status and by type, plus the newest few.

    The two count sets come from one pass with conditional aggregates rather
    than two group-bys, because the inbox badge and the type breakdown are
    always rendered together.
    """
    status_row = db.execute(
        select(
            *[func.count(case((Alert.status == s, 1))).label(s.value) for s in AlertStatus]
        ).where(Alert.farm_id == farm_id)
    ).one()
    type_row = db.execute(
        select(
            *[func.count(case((Alert.alert_type == t, 1))).label(t.value) for t in AlertType]
        ).where(Alert.farm_id == farm_id)
    ).one()
    recent = list(
        db.scalars(
            select(Alert)
            .where(Alert.farm_id == farm_id)
            .order_by(Alert.alert_date.desc(), Alert.id.desc())
            .limit(recent_limit)
        ).all()
    )
    return AlertSummary(
        by_status={s.value: int(getattr(status_row, s.value)) for s in AlertStatus},
        by_type={t.value: int(getattr(type_row, t.value)) for t in AlertType},
        recent=recent,
    )


__all__ = [
    "AlertSummary",
    "GroupRow",
    "HerdGrowthPoint",
    "Interval",
    "WeightBucket",
    "alert_summary",
    "compute_bucket_gains",
    "feed_totals_by_bucket",
    "group_active_hogs",
    "herd_growth_series",
    "latest_weight_per_hog_by_bucket",
    "weight_histogram",
]
