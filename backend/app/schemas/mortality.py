from datetime import date, datetime

from pydantic import BaseModel, Field


class MortalityEventCreate(BaseModel):
    hog_id: int
    event_date: date
    cause: str = Field(min_length=1, max_length=128)
    notes: str | None = None


class MortalityEventRead(BaseModel):
    id: int
    hog_id: int
    farm_id: int
    event_date: date
    cause: str
    notes: str | None
    created_by_user_id: int | None
    updated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
