from datetime import date

from pydantic import BaseModel, Field


class GrowthPoint(BaseModel):
    date: date
    weight_kg: float


class GrowthSeriesResponse(BaseModel):
    hog_id: int
    date_from: date | None
    date_to: date | None
    actual: list[GrowthPoint]
    forecast: list[GrowthPoint] = Field(default_factory=list)


class DashboardKpisResponse(BaseModel):
    """The headline figures.

    `feed_cost_by_currency` and the mixed-currency nulling are gone: a farm holds
    exactly one currency now that feed writes take it from `farm.currency_code`,
    so the branch that reported `None` for every cost figure was unreachable by
    construction (audit i). `currency_code` is reported once, at the top.
    """

    date_from: date
    date_to: date
    breed_filter: str | None
    market_weight_kg: float
    currency_code: str
    hogs_with_growth_measure: int
    avg_daily_gain_kg: float | None
    total_weight_gain_kg: float
    health_records_count: int
    feed_records_count: int
    total_feed_kg: float
    total_feed_cost: float
    feed_cost_per_kg_gain: float | None
    # Feed conversion ratio — kg of feed per kg of live-weight gain. The single
    # most-quoted efficiency figure in pig production, and the reason feed weight
    # is now summed alongside feed cost.
    fcr: float | None
    market_ready_count: int
    active_hogs_count: int
    market_ready_measured_count: int
    market_ready_pct: float | None
    mortality_count: int
    mortality_rate_pct: float | None
    open_alerts_count: int


class LeaderboardRow(BaseModel):
    hog_id: int
    tag_number: str
    breed: str
    production_class: str
    adg_kg_per_day: float
    weight_gain_kg: float
    days: int
    feed_kg: float
    fcr: float | None
    # Judged against the mean for the animal's own production class, not a
    # herd-wide floor. A piglet gaining 0.2 kg/day is performing normally;
    # measured against the herd it looks like a failure, and on a piglet-heavy
    # herd that flagged 85% of the animals — a useless signal.
    is_underperformer: bool


class LeaderboardResponse(BaseModel):
    date_from: date
    date_to: date
    breed_filter: str | None
    metric: str
    direction: str
    rows: list[LeaderboardRow]
