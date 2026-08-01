from datetime import datetime

from pydantic import BaseModel, Field


class DataVersionResponse(BaseModel):
    """The client's cache-invalidation signal.

    Polled on an interval; when `version` moves, the dashboard invalidates every
    query keyed to the farm. One number rather than per-resource versions,
    because the alternative is a poll per chart for a farm whose tables all
    change together anyway.
    """

    farm_id: int
    version: int
    updated_at: datetime | None


class FarmSummary(BaseModel):
    id: int
    name: str
    timezone: str
    currency_code: str
    hog_count: int
    created_at: datetime


class FarmUpdate(BaseModel):
    """The name, and only the name.

    Currency and timezone stay server-owned. Feed records store `currency_code`
    at write time for historical accuracy, so changing a farm's currency would
    leave the money charts summing two units; the timezone is set per deployment
    and moving it silently reinterprets what "today" meant for existing records.
    """

    name: str = Field(min_length=1, max_length=255)
