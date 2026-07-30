from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class FeedRecordCreate(BaseModel):
    hog_id: int
    feed_amount: Decimal = Field(ge=0)
    feed_cost: Decimal = Field(ge=0)
    record_date: date


class FeedRecordUpdate(BaseModel):
    feed_amount: Decimal | None = Field(default=None, ge=0)
    feed_cost: Decimal | None = Field(default=None, ge=0)
    record_date: date | None = None


class FeedRecordRead(BaseModel):
    id: int
    hog_id: int
    feed_amount: Decimal
    feed_cost: Decimal
    currency_code: str
    record_date: date
    created_by_user_id: int | None
    updated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
