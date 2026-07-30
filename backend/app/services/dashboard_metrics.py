"""Dashboard KPI and time-series helpers.

All farm scoping goes through the denormalized `farm_id` on the record tables
rather than `JOIN hogs`. The join is now only taken when a breed filter is
actually supplied.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.orm import Session

from app.models.alert import Alert, AlertStatus
from app.models.feed_record import FeedRecord
from app.models.health_record import HealthRecord
from app.models.hog import Hog, HogStatus, ProductionClass
from app.models.mortality_event import MortalityEvent


@dataclass(frozen=True)
class HogWeightEndpoints:
    """First and last weigh-in for one hog within a window.

    The ADG calculation only ever needed these two points per hog. Previously the
    whole series was transferred and reduced in Python — at 500 hogs x 200
    records that is 100k rows fetched to derive 1,000 values.
    """

    hog_id: int
    tag_number: str
    breed: str
    production_class: ProductionClass
    first_date: date
    first_weight_kg: Decimal
    last_date: date
    last_weight_kg: Decimal


@dataclass(frozen=True)
class HogAdgRow:
    hog_id: int
    tag_number: str
    breed: str
    production_class: ProductionClass
    adg_kg_per_day: float
    weight_gain_kg: float
    days: int


def _hog_query(
    farm_id: int, breed: str | None, statuses: Iterable[HogStatus] | None = None
) -> Select[tuple[Hog]]:
    stmt = select(Hog).where(Hog.farm_id == farm_id)
    if breed:
        stmt = stmt.where(Hog.breed == breed)
    if statuses is not None:
        stmt = stmt.where(Hog.status.in_(list(statuses)))
    return stmt


def fetch_weight_endpoints_in_range(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    breed: str | None,
) -> list[HogWeightEndpoints]:
    """First and last weigh-in per hog, reduced in the database.

    Two ROW_NUMBER() windows rank each hog's records forwards and backwards; the
    outer aggregate keeps only rank 1 from each. One pass, at most two rows per
    hog crossing the wire.
    """
    hr = HealthRecord
    base = select(
        hr.hog_id,
        hr.record_date,
        hr.weight,
        func.row_number()
        .over(partition_by=hr.hog_id, order_by=(hr.record_date.asc(), hr.id.asc()))
        .label("rn_first"),
        func.row_number()
        .over(partition_by=hr.hog_id, order_by=(hr.record_date.desc(), hr.id.desc()))
        .label("rn_last"),
    ).where(
        hr.farm_id == farm_id,
        hr.record_date >= date_from,
        hr.record_date <= date_to,
    )
    if breed:
        base = base.join(Hog, hr.hog_id == Hog.id).where(Hog.breed == breed)

    ranked = base.subquery("ranked")
    endpoints = (
        select(
            ranked.c.hog_id,
            func.max(case((ranked.c.rn_first == 1, ranked.c.record_date))).label("first_date"),
            func.max(case((ranked.c.rn_first == 1, ranked.c.weight))).label("first_weight"),
            func.max(case((ranked.c.rn_last == 1, ranked.c.record_date))).label("last_date"),
            func.max(case((ranked.c.rn_last == 1, ranked.c.weight))).label("last_weight"),
        )
        .where(or_(ranked.c.rn_first == 1, ranked.c.rn_last == 1))
        .group_by(ranked.c.hog_id)
        .subquery("endpoints")
    )

    stmt = select(
        endpoints.c.hog_id,
        Hog.tag_number,
        Hog.breed,
        Hog.production_class,
        endpoints.c.first_date,
        endpoints.c.first_weight,
        endpoints.c.last_date,
        endpoints.c.last_weight,
    ).join(Hog, Hog.id == endpoints.c.hog_id)

    return [
        HogWeightEndpoints(
            hog_id=r[0],
            tag_number=r[1],
            breed=r[2],
            production_class=r[3],
            first_date=r[4],
            first_weight_kg=Decimal(str(r[5])),
            last_date=r[6],
            last_weight_kg=Decimal(str(r[7])),
        )
        for r in db.execute(stmt).all()
    ]


def compute_adg_rows(endpoints: list[HogWeightEndpoints]) -> list[HogAdgRow]:
    """Average daily gain per hog. Pure — this is the unit-testable core.

    Hogs with a single weigh-in (or several on one day) span zero days and are
    skipped: dividing by that span is undefined, not zero.
    """
    out: list[HogAdgRow] = []
    for e in endpoints:
        days = (e.last_date - e.first_date).days
        if days <= 0:
            continue
        gain = float(e.last_weight_kg - e.first_weight_kg)
        out.append(
            HogAdgRow(
                hog_id=e.hog_id,
                tag_number=e.tag_number,
                breed=e.breed,
                production_class=e.production_class,
                adg_kg_per_day=gain / days,
                weight_gain_kg=gain,
                days=days,
            )
        )
    return out


def _count_in_range(
    db: Session,
    model: type[HealthRecord] | type[FeedRecord],
    farm_id: int,
    date_from: date,
    date_to: date,
    breed: str | None,
) -> int:
    stmt = select(func.count(model.id)).where(
        model.farm_id == farm_id,
        model.record_date >= date_from,
        model.record_date <= date_to,
    )
    if breed:
        stmt = stmt.join(Hog, model.hog_id == Hog.id).where(Hog.breed == breed)
    return int(db.scalar(stmt) or 0)


def count_health_records_in_range(
    db: Session, farm_id: int, date_from: date, date_to: date, breed: str | None
) -> int:
    return _count_in_range(db, HealthRecord, farm_id, date_from, date_to, breed)


def count_feed_records_in_range(
    db: Session, farm_id: int, date_from: date, date_to: date, breed: str | None
) -> int:
    return _count_in_range(db, FeedRecord, farm_id, date_from, date_to, breed)


@dataclass(frozen=True)
class FeedTotals:
    feed_kg: Decimal
    feed_cost: Decimal


def feed_totals_in_range(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    breed: str | None,
) -> FeedTotals:
    """Feed consumed and spent over the window.

    No longer grouped by currency. A farm holds exactly one currency now that
    writes take it from `farm.currency_code`, so the group-by only ever returned
    one row — and the "mixed currency, report nothing" branch it fed was what
    blanked every cost KPI (audit i).
    """
    stmt = select(
        func.coalesce(func.sum(FeedRecord.feed_amount), 0),
        func.coalesce(func.sum(FeedRecord.feed_cost), 0),
    ).where(
        FeedRecord.farm_id == farm_id,
        FeedRecord.record_date >= date_from,
        FeedRecord.record_date <= date_to,
    )
    if breed:
        stmt = stmt.join(Hog, FeedRecord.hog_id == Hog.id).where(Hog.breed == breed)
    kg, cost = db.execute(stmt).one()
    return FeedTotals(feed_kg=Decimal(str(kg)), feed_cost=Decimal(str(cost)))


def feed_kg_by_hog_in_range(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
) -> dict[int, float]:
    """Feed consumed per hog — the denominator of a per-animal FCR."""
    rows = db.execute(
        select(FeedRecord.hog_id, func.coalesce(func.sum(FeedRecord.feed_amount), 0))
        .where(
            FeedRecord.farm_id == farm_id,
            FeedRecord.record_date >= date_from,
            FeedRecord.record_date <= date_to,
        )
        .group_by(FeedRecord.hog_id)
    ).all()
    return {int(hog_id): float(kg) for hog_id, kg in rows}


def count_mortalities_in_range(
    db: Session,
    farm_id: int,
    date_from: date,
    date_to: date,
    breed: str | None,
) -> int:
    stmt = select(func.count(MortalityEvent.id)).where(
        MortalityEvent.farm_id == farm_id,
        MortalityEvent.event_date >= date_from,
        MortalityEvent.event_date <= date_to,
    )
    if breed:
        stmt = stmt.join(Hog, MortalityEvent.hog_id == Hog.id).where(Hog.breed == breed)
    return int(db.scalar(stmt) or 0)


def count_open_alerts(db: Session, farm_id: int) -> int:
    """Deliberately not windowed by the dashboard's date range.

    An alert raised two months ago and never actioned is still open today.
    Filtering it out by date would hide exactly the ones that matter most.
    """
    return int(
        db.scalar(
            select(func.count(Alert.id)).where(
                Alert.farm_id == farm_id, Alert.status == AlertStatus.open
            )
        )
        or 0
    )


def total_weight_gain_kg(adg_rows: list[HogAdgRow]) -> float:
    return float(sum(r.weight_gain_kg for r in adg_rows))


@dataclass(frozen=True)
class MarketReadiness:
    ready_count: int
    active_count: int
    #  Hogs with at least one weigh-in on or before the cut-off. Reported
    #  separately because an unweighed hog is *unknown*, not "not ready" —
    #  folding it into ready/active silently depresses the percentage.
    measured_count: int


def market_ready_stats(
    db: Session,
    farm_id: int,
    date_to: date,
    breed: str | None,
    market_weight_kg: float,
) -> MarketReadiness:
    """How many active hogs have reached market weight, by latest known weight.

    DISTINCT ON keeps only the newest record per hog inside the database. The
    previous implementation fetched every health record for every active hog and
    discarded ~99% of them in Python.
    """
    active_stmt = select(Hog.id).where(Hog.farm_id == farm_id, Hog.status == HogStatus.active)
    if breed:
        active_stmt = active_stmt.where(Hog.breed == breed)
    active_ids = active_stmt.subquery("active_hogs")

    latest = (
        select(HealthRecord.hog_id, HealthRecord.weight)
        .where(
            HealthRecord.farm_id == farm_id,
            HealthRecord.record_date <= date_to,
            HealthRecord.hog_id.in_(select(active_ids.c.id)),
        )
        .order_by(HealthRecord.hog_id, HealthRecord.record_date.desc(), HealthRecord.id.desc())
        .distinct(HealthRecord.hog_id)
        .subquery("latest_weights")
    )

    threshold = Decimal(str(market_weight_kg))
    row = db.execute(
        select(
            func.count().label("measured"),
            func.count(case((latest.c.weight >= threshold, 1))).label("ready"),
        ).select_from(latest)
    ).one()
    active_count = int(db.scalar(select(func.count()).select_from(active_ids)) or 0)
    return MarketReadiness(
        ready_count=int(row.ready or 0),
        active_count=active_count,
        measured_count=int(row.measured or 0),
    )


def fetch_growth_series_for_hog(
    db: Session,
    farm_id: int,
    hog_id: int,
    date_from: date | None,
    date_to: date | None,
) -> list[tuple[date, Decimal]]:
    stmt = (
        select(HealthRecord.record_date, HealthRecord.weight)
        .where(HealthRecord.farm_id == farm_id, HealthRecord.hog_id == hog_id)
        .order_by(HealthRecord.record_date, HealthRecord.id)
    )
    if date_from is not None:
        stmt = stmt.where(HealthRecord.record_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(HealthRecord.record_date <= date_to)
    return [(r[0], Decimal(str(r[1]))) for r in db.execute(stmt).all()]
