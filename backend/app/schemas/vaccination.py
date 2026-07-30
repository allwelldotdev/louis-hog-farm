from datetime import date, datetime

from pydantic import BaseModel, Field


class VaccinationCreate(BaseModel):
    hog_id: int
    vaccine_name: str = Field(min_length=1, max_length=128)
    dose_date: date
    # What makes `AlertType.vaccination_due` reachable: the rule evaluator has
    # nothing to fire on until a dose declares when the next one falls due.
    next_due_date: date | None = None
    notes: str | None = None


class VaccinationRead(BaseModel):
    id: int
    hog_id: int
    farm_id: int
    vaccine_name: str
    dose_date: date
    next_due_date: date | None
    notes: str | None
    created_by_user_id: int | None
    updated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
