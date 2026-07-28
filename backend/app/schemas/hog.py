from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.hog import HogStatus


class HogCreate(BaseModel):
    tag_number: str = Field(min_length=1, max_length=64)
    birth_date: date
    breed: str = Field(min_length=1, max_length=128)


class HogUpdate(BaseModel):
    tag_number: str | None = Field(default=None, min_length=1, max_length=64)
    birth_date: date | None = None
    breed: str | None = Field(default=None, min_length=1, max_length=128)
    status: HogStatus | None = None


class HogRead(BaseModel):
    id: int
    farm_id: int
    tag_number: str
    birth_date: date
    breed: str
    status: HogStatus
    created_by_user_id: int | None
    updated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
