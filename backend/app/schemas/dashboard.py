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


class UnderperformerRow(BaseModel):
    hog_id: int
    tag_number: str
    breed: str
    adg_kg_per_day: float


class CurrencyTotal(BaseModel):
    currency_code: str
    total_feed_cost: float


class DashboardKpisResponse(BaseModel):
    date_from: date
    date_to: date
    breed_filter: str | None
    market_weight_kg: float
    hogs_with_growth_measure: int
    avg_daily_gain_kg: float | None
    total_weight_gain_kg: float
    health_records_count: int
    feed_records_count: int
    total_feed_cost: float | None
    feed_cost_by_currency: list[CurrencyTotal]
    feed_cost_per_kg_gain: float | None
    market_ready_count: int
    active_hogs_count: int
    market_ready_measured_count: int
    market_ready_pct: float | None
    underperformers: list[UnderperformerRow]
