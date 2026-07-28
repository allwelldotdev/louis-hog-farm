from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
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
    fetch_health_points_in_range,
    market_ready_stats,
    total_feed_cost_in_range,
    total_weight_gain_kg,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _default_range(
    date_from: date | None,
    date_to: date | None,
) -> tuple[date, date]:
    today = datetime.now(timezone.utc).date()
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
    market_weight_kg: float = Query(default=115.0, ge=0, description="Target live weight (kg) for market-ready %"),
) -> DashboardKpisResponse:
    start, end = _default_range(date_from, date_to)
    points = fetch_health_points_in_range(db, user.farm_id, start, end, breed)
    health_records_count = count_health_records_in_range(db, user.farm_id, start, end, breed)
    feed_records_count = count_feed_records_in_range(db, user.farm_id, start, end, breed)
    adg_rows = compute_adg_rows(points)
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

    under: list[UnderperformerRow] = []
    if adg_rows and avg_adg is not None and avg_adg > 0:
        threshold = max(0.35, 0.85 * avg_adg)
        for r in sorted(adg_rows, key=lambda x: x.adg_kg_per_day):
            if r.adg_kg_per_day < threshold:
                under.append(
                    UnderperformerRow(
                        hog_id=r.hog_id,
                        tag_number=r.tag_number,
                        breed=r.breed,
                        adg_kg_per_day=r.adg_kg_per_day,
                    )
                )
    elif adg_rows:
        for r in sorted(adg_rows, key=lambda x: x.adg_kg_per_day):
            if r.adg_kg_per_day < 0.35:
                under.append(
                    UnderperformerRow(
                        hog_id=r.hog_id,
                        tag_number=r.tag_number,
                        breed=r.breed,
                        adg_kg_per_day=r.adg_kg_per_day,
                    )
                )

    ready, active = market_ready_stats(db, user.farm_id, end, breed, market_weight_kg)
    mkt_pct = (ready / active * 100.0) if active else None

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
        feed_cost_by_currency=[CurrencyTotal(currency_code=k, total_feed_cost=float(v)) for k, v in sorted(feed_by_ccy.items())],
        feed_cost_per_kg_gain=per_kg,
        market_ready_count=ready,
        active_hogs_count=active,
        market_ready_pct=mkt_pct,
        underperformers=under[:50],
    )
