from collections import defaultdict
from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.cache import DashboardCache
from app.api.deps import CurrentUser
from app.core.time import farm_today
from app.db.session import get_db
from app.schemas.alert import AlertRead
from app.schemas.dashboard import (
    AlertSummaryResponse,
    DashboardKpisResponse,
    DistributionResponse,
    DistributionRow,
    FeedCostPoint,
    FeedCostSeriesResponse,
    HerdGrowthPointOut,
    HerdGrowthResponse,
    LeaderboardResponse,
    LeaderboardRow,
    WeightBucketOut,
    WeightDistributionResponse,
)
from app.services.dashboard_metrics import (
    HogAdgRow,
    compute_adg_rows,
    count_feed_records_in_range,
    count_health_records_in_range,
    count_mortalities_in_range,
    count_open_alerts,
    feed_kg_by_hog_in_range,
    feed_totals_in_range,
    fetch_weight_endpoints_in_range,
    market_ready_stats,
    total_weight_gain_kg,
)
from app.services.dashboard_series import (
    Interval,
    alert_summary,
    compute_bucket_gains,
    feed_totals_by_bucket,
    group_active_hogs,
    herd_growth_series,
    latest_weight_per_hog_by_bucket,
    weight_histogram,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# An animal is flagged when it gains less than this share of the mean for its own
# production class.
UNDERPERFORMER_FRACTION = 0.85


def _default_range(
    date_from: date | None,
    date_to: date | None,
    timezone: str,
) -> tuple[date, date]:
    today = farm_today(timezone)
    end = date_to or today
    start = date_from or (end - timedelta(days=90))
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be on or before date_to",
        )
    return start, end


def _class_thresholds(adg_rows: list[HogAdgRow]) -> dict[str, float]:
    by_class: dict[str, list[float]] = defaultdict(list)
    for r in adg_rows:
        by_class[r.production_class.value].append(r.adg_kg_per_day)
    return {
        cls: UNDERPERFORMER_FRACTION * (sum(values) / len(values))
        for cls, values in by_class.items()
        if values
    }


@router.get("/kpis", response_model=DashboardKpisResponse)
def get_dashboard_kpis(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    cache: DashboardCache,
    date_from: date | None = None,
    date_to: date | None = None,
    breed: str | None = Query(default=None, description="Exact breed filter (optional)"),
    market_weight_kg: float = Query(
        default=115.0, ge=0, description="Target live weight (kg) for market-ready %"
    ),
) -> DashboardKpisResponse:
    start, end = _default_range(date_from, date_to, user.farm.timezone)
    endpoints = fetch_weight_endpoints_in_range(db, user.farm_id, start, end, breed)
    health_records_count = count_health_records_in_range(db, user.farm_id, start, end, breed)
    feed_records_count = count_feed_records_in_range(db, user.farm_id, start, end, breed)
    adg_rows = compute_adg_rows(endpoints)
    avg_adg = sum(r.adg_kg_per_day for r in adg_rows) / len(adg_rows) if adg_rows else None
    gain_total = total_weight_gain_kg(adg_rows)

    feed = feed_totals_in_range(db, user.farm_id, start, end, breed)
    feed_kg = float(feed.feed_kg)
    feed_cost = float(feed.feed_cost)
    per_kg = feed_cost / gain_total if gain_total > 0 else None
    fcr = feed_kg / gain_total if gain_total > 0 and feed_kg > 0 else None

    readiness = market_ready_stats(db, user.farm_id, end, breed, market_weight_kg)
    # Percentage is over hogs actually weighed: an unweighed hog is unknown,
    # not "not ready", and counting it as the latter depressed the figure.
    mkt_pct = (
        (readiness.ready_count / readiness.measured_count * 100.0)
        if readiness.measured_count
        else None
    )

    mortality_count = count_mortalities_in_range(db, user.farm_id, start, end, breed)
    # Denominator is the population that was at risk during the window: animals
    # still alive plus those that died in it. Dividing by the live herd alone
    # understates the rate, because the deaths have already left that count.
    at_risk = readiness.active_count + mortality_count
    mortality_rate = (mortality_count / at_risk * 100.0) if at_risk else None

    return DashboardKpisResponse(
        date_from=start,
        date_to=end,
        breed_filter=breed,
        market_weight_kg=market_weight_kg,
        currency_code=user.farm.currency_code,
        hogs_with_growth_measure=len(adg_rows),
        avg_daily_gain_kg=avg_adg,
        total_weight_gain_kg=gain_total,
        health_records_count=health_records_count,
        feed_records_count=feed_records_count,
        total_feed_kg=feed_kg,
        total_feed_cost=feed_cost,
        feed_cost_per_kg_gain=per_kg,
        fcr=fcr,
        market_ready_count=readiness.ready_count,
        active_hogs_count=readiness.active_count,
        market_ready_measured_count=readiness.measured_count,
        market_ready_pct=mkt_pct,
        mortality_count=mortality_count,
        mortality_rate_pct=mortality_rate,
        open_alerts_count=count_open_alerts(db, user.farm_id),
    )


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    cache: DashboardCache,
    date_from: date | None = None,
    date_to: date | None = None,
    breed: str | None = Query(default=None, description="Exact breed filter (optional)"),
    metric: Literal["adg", "gain", "fcr"] = "adg",
    direction: Literal["top", "bottom"] = "top",
    limit: int = Query(default=10, ge=1, le=100),
) -> LeaderboardResponse:
    """Best and worst performers over the window.

    This is where `underperformers` moved to from `/kpis`. It was always a
    ranking rather than a headline figure, and inlining it meant the KPI payload
    carried up to fifty rows that most callers discarded.
    """
    start, end = _default_range(date_from, date_to, user.farm.timezone)
    adg_rows = compute_adg_rows(
        fetch_weight_endpoints_in_range(db, user.farm_id, start, end, breed)
    )
    feed_by_hog = feed_kg_by_hog_in_range(db, user.farm_id, start, end)
    thresholds = _class_thresholds(adg_rows)

    rows = []
    for r in adg_rows:
        feed_kg = feed_by_hog.get(r.hog_id, 0.0)
        rows.append(
            LeaderboardRow(
                hog_id=r.hog_id,
                tag_number=r.tag_number,
                breed=r.breed,
                production_class=r.production_class.value,
                adg_kg_per_day=r.adg_kg_per_day,
                weight_gain_kg=r.weight_gain_kg,
                days=r.days,
                feed_kg=feed_kg,
                fcr=(feed_kg / r.weight_gain_kg) if r.weight_gain_kg > 0 and feed_kg > 0 else None,
                is_underperformer=r.adg_kg_per_day < thresholds.get(r.production_class.value, 0.0),
            )
        )

    if metric == "fcr":
        # A hog with no gain or no feed has no ratio; ranking it alongside real
        # ratios would put a measurement gap at the top of the table. Lower FCR
        # is better, so "top" sorts ascending here and descending elsewhere.
        ranked = sorted((r for r in rows if r.fcr is not None), key=lambda r: r.fcr or 0.0)
        if direction == "bottom":
            ranked.reverse()
    else:
        key = (lambda r: r.adg_kg_per_day) if metric == "adg" else (lambda r: r.weight_gain_kg)
        ranked = sorted(rows, key=key, reverse=direction == "top")

    return LeaderboardResponse(
        date_from=start,
        date_to=end,
        breed_filter=breed,
        metric=metric,
        direction=direction,
        rows=ranked[:limit],
    )


@router.get("/herd-growth", response_model=HerdGrowthResponse)
def get_herd_growth(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    cache: DashboardCache,
    date_from: date | None = None,
    date_to: date | None = None,
    breed: str | None = Query(default=None, description="Exact breed filter (optional)"),
    interval: Interval = "week",
) -> HerdGrowthResponse:
    """Weight distribution over time — the dashboard's headline chart.

    Weekly by default because that is the weigh-in cadence; a daily interval on
    weekly data produces a chart that is mostly gaps.
    """
    start, end = _default_range(date_from, date_to, user.farm.timezone)
    points = herd_growth_series(db, user.farm_id, start, end, breed, interval)
    return HerdGrowthResponse(
        date_from=start,
        date_to=end,
        breed_filter=breed,
        interval=interval,
        points=[
            HerdGrowthPointOut(
                bucket=p.bucket,
                hog_count=p.hog_count,
                avg_weight_kg=p.avg_weight_kg,
                median_weight_kg=p.median_weight_kg,
                p10_weight_kg=p.p10_weight_kg,
                p90_weight_kg=p.p90_weight_kg,
            )
            for p in points
        ],
    )


def _distribution(
    db: Session,
    farm_id: int,
    timezone: str,
    date_from: date | None,
    date_to: date | None,
    by: Literal["breed", "production_class"],
) -> DistributionResponse:
    start, end = _default_range(date_from, date_to, timezone)
    groups = group_active_hogs(db, farm_id, end, by)
    adg_rows = compute_adg_rows(fetch_weight_endpoints_in_range(db, farm_id, start, end, None))

    adg_by_key: dict[str, list[float]] = defaultdict(list)
    for r in adg_rows:
        key = r.breed if by == "breed" else r.production_class.value
        adg_by_key[key].append(r.adg_kg_per_day)

    return DistributionResponse(
        date_from=start,
        date_to=end,
        group_by=by,
        total_hogs=sum(g.hog_count for g in groups),
        rows=[
            DistributionRow(
                key=g.key,
                hog_count=g.hog_count,
                avg_weight_kg=g.avg_weight_kg,
                avg_adg_kg_per_day=(
                    sum(adg_by_key[g.key]) / len(adg_by_key[g.key]) if adg_by_key[g.key] else None
                ),
            )
            for g in groups
        ],
    )


@router.get("/breed-distribution", response_model=DistributionResponse)
def get_breed_distribution(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    cache: DashboardCache,
    date_from: date | None = None,
    date_to: date | None = None,
) -> DistributionResponse:
    """Herd composition by breed, with mean weight and mean ADG per breed.

    Doubles as the breed facet for the dashboard's filters — the list offered in
    the UI is exactly what this returns, so there is no separate facets endpoint
    that could fall out of step with the data.
    """
    return _distribution(db, user.farm_id, user.farm.timezone, date_from, date_to, "breed")


@router.get("/production-class-distribution", response_model=DistributionResponse)
def get_production_class_distribution(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    cache: DashboardCache,
    date_from: date | None = None,
    date_to: date | None = None,
) -> DistributionResponse:
    return _distribution(
        db, user.farm_id, user.farm.timezone, date_from, date_to, "production_class"
    )


@router.get("/weight-distribution", response_model=WeightDistributionResponse)
def get_weight_distribution(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    cache: DashboardCache,
    date_to: date | None = None,
    breed: str | None = Query(default=None, description="Exact breed filter (optional)"),
    bucket_kg: float = Query(default=10.0, gt=0, le=100),
) -> WeightDistributionResponse:
    """Histogram of each active hog's latest known weight."""
    as_of = date_to or farm_today(user.farm.timezone)
    buckets = weight_histogram(db, user.farm_id, as_of, breed, bucket_kg)
    return WeightDistributionResponse(
        as_of=as_of,
        breed_filter=breed,
        bucket_kg=bucket_kg,
        total_hogs=sum(b.hog_count for b in buckets),
        buckets=[
            WeightBucketOut(lower_kg=b.lower_kg, upper_kg=b.upper_kg, hog_count=b.hog_count)
            for b in buckets
        ],
    )


@router.get("/feed-cost-series", response_model=FeedCostSeriesResponse)
def get_feed_cost_series(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    cache: DashboardCache,
    date_from: date | None = None,
    date_to: date | None = None,
    interval: Interval = "week",
) -> FeedCostSeriesResponse:
    """Feed spend per bucket, and what each kilogram of gain cost.

    The gain denominator counts only animals weighed in both the bucket and the
    one before it, so a sale or a birth between buckets cannot masquerade as
    herd growth.
    """
    start, end = _default_range(date_from, date_to, user.farm.timezone)
    gains = compute_bucket_gains(
        latest_weight_per_hog_by_bucket(db, user.farm_id, start, end, interval)
    )
    return FeedCostSeriesResponse(
        date_from=start,
        date_to=end,
        interval=interval,
        currency_code=user.farm.currency_code,
        points=[
            FeedCostPoint(
                bucket=bucket,
                feed_kg=feed_kg,
                feed_cost=feed_cost,
                cost_per_kg_gain=(
                    feed_cost / gains[bucket] if gains.get(bucket, 0.0) > 0 else None
                ),
            )
            for bucket, feed_kg, feed_cost in feed_totals_by_bucket(
                db, user.farm_id, start, end, interval
            )
        ],
    )


@router.get("/alert-summary", response_model=AlertSummaryResponse)
def get_alert_summary(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    cache: DashboardCache,
) -> AlertSummaryResponse:
    """Counts by status and type plus the newest few — the alerts inbox header.

    Not date-filtered: an alert raised outside the dashboard's window and still
    open is precisely the one worth surfacing.
    """
    summary = alert_summary(db, user.farm_id)
    return AlertSummaryResponse(
        by_status=summary.by_status,
        by_type=summary.by_type,
        recent=[AlertRead.model_validate(a) for a in summary.recent],
    )
