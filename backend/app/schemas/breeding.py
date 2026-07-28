from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.breeding_cycle import BreedingStatus


class BreedingCycleCreate(BaseModel):
    hog_id: int
    start_date: date
    notes: str | None = None


class BreedingCycleUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    status: BreedingStatus | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "BreedingCycleUpdate":
        if self.end_date is not None and self.start_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class BreedingCycleRead(BaseModel):
    id: int
    hog_id: int
    start_date: date
    end_date: date | None
    status: BreedingStatus
    notes: str | None
    created_by_user_id: int | None
    updated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
