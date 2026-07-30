from datetime import datetime

from pydantic import BaseModel


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
