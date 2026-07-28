from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class HealthRecordCreate(BaseModel):
    hog_id: int
    weight: Decimal = Field(gt=0)
    temperature: Decimal | None = None
    notes: str | None = None
    record_date: date


class HealthRecordUpdate(BaseModel):
    weight: Decimal | None = Field(default=None, gt=0)
    temperature: Decimal | None = None
    notes: str | None = None
    record_date: date | None = None


class HealthRecordRead(BaseModel):
    id: int
    hog_id: int
    weight: Decimal
    temperature: Decimal | None
    notes: str | None
    record_date: date
    created_by_user_id: int | None
    updated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
