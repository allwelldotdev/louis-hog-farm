from collections import defaultdict
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.time import utc_today
from app.db.session import get_db
from app.schemas.dashboard import (
    CurrencyTotal,
    DashboardKpisResponse,
    UnderperformerRow,
)
from app.services.dashboard_metrics import (
    compute_adg_rows,
    count_feed_records_in_range,
    count_health_records_in_range,
    fetch_weight_endpoints_in_range,
    market_ready_stats,
    total_feed_cost_in_range,
    total_weight_gain_kg,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _default_range(
    date_from: date | None,
    date_to: date | None,
) -> tuple[date, date]:
    today = utc_today()
    end = date_to or today
    start = date_from or (end - timedelta(days=90))
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be on or before date_to",
        )
    return start, end


@router.get("/kpis", response_model=DashboardKpisResponse)
def get_dashboard_kpis(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
    breed: str | None = Query(default=None, description="Exact breed filter (optional)"),
    market_weight_kg: float = Query(
        default=115.0, ge=0, description="Target live weight (kg) for market-ready %"
    ),
) -> DashboardKpisResponse:
    start, end = _default_range(date_from, date_to)
    endpoints = fetch_weight_endpoints_in_range(db, user.farm_id, start, end, breed)
    health_records_count = count_health_records_in_range(db, user.farm_id, start, end, breed)
    feed_records_count = count_feed_records_in_range(db, user.farm_id, start, end, breed)
    adg_rows = compute_adg_rows(endpoints)
    avg_adg = sum(r.adg_kg_per_day for r in adg_rows) / len(adg_rows) if adg_rows else None
    gain_total = total_weight_gain_kg(adg_rows)
    feed_grand, feed_by_ccy = total_feed_cost_in_range(db, user.farm_id, start, end, breed)
    mixed = len(feed_by_ccy) > 1
    total_cost: float | None
    if mixed:
        total_cost = None
        per_kg = None
    else:
        total_cost = float(feed_grand) if feed_by_ccy else 0.0
        per_kg = None
        if gain_total > 0 and feed_by_ccy:
            per_kg = float(next(iter(feed_by_ccy.values()))) / gain_total

    # Compared against peers in the same production class, not a herd-wide
    # figure. A piglet gaining 0.2 kg/day is performing normally; judged against
    # a flat floor it looks like a failure, and on a piglet-heavy herd that
    # flagged 85% of the animals — a useless signal.
    by_class: dict[str, list[float]] = defaultdict(list)
    for r in adg_rows:
        by_class[r.production_class.value].append(r.adg_kg_per_day)
    class_threshold = {
        cls: 0.85 * (sum(values) / len(values)) for cls, values in by_class.items() if values
    }
    under = [
        UnderperformerRow(
            hog_id=r.hog_id,
            tag_number=r.tag_number,
            breed=r.breed,
            production_class=r.production_class.value,
            adg_kg_per_day=r.adg_kg_per_day,
        )
        for r in sorted(adg_rows, key=lambda x: x.adg_kg_per_day)[:50]
        if r.adg_kg_per_day < class_threshold.get(r.production_class.value, 0.0)
    ]

    readiness = market_ready_stats(db, user.farm_id, end, breed, market_weight_kg)
    # Percentage is over hogs actually weighed: an unweighed hog is unknown,
    # not "not ready", and counting it as the latter depressed the figure.
    mkt_pct = (
        (readiness.ready_count / readiness.measured_count * 100.0)
        if readiness.measured_count
        else None
    )

    return DashboardKpisResponse(
        date_from=start,
        date_to=end,
        breed_filter=breed,
        market_weight_kg=market_weight_kg,
        hogs_with_growth_measure=len(adg_rows),
        avg_daily_gain_kg=avg_adg,
        total_weight_gain_kg=gain_total,
        health_records_count=health_records_count,
        feed_records_count=feed_records_count,
        total_feed_cost=total_cost,
        feed_cost_by_currency=[
            CurrencyTotal(currency_code=k, total_feed_cost=float(v))
            for k, v in sorted(feed_by_ccy.items())
        ],
        feed_cost_per_kg_gain=per_kg,
        market_ready_count=readiness.ready_count,
        active_hogs_count=readiness.active_count,
        market_ready_measured_count=readiness.measured_count,
        market_ready_pct=mkt_pct,
        underperformers=under,
    )
