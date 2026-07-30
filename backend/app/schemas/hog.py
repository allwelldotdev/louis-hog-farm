from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.hog import HogSex, HogStatus, ProductionClass


class HogCreate(BaseModel):
    tag_number: str = Field(min_length=1, max_length=64)
    birth_date: date
    breed: str = Field(min_length=1, max_length=128)
    sex: HogSex = HogSex.female
    production_class: ProductionClass = ProductionClass.piglet
    # Lineage, set when a farrowing is recorded. Both must be hogs on the same
    # farm; the endpoint checks rather than trusting the ids.
    dam_id: int | None = None
    sire_id: int | None = None


class HogUpdate(BaseModel):
    tag_number: str | None = Field(default=None, min_length=1, max_length=64)
    birth_date: date | None = None
    breed: str | None = Field(default=None, min_length=1, max_length=128)
    status: HogStatus | None = None
    sex: HogSex | None = None
    # Editable because the progression piglet -> weaner -> grower -> finisher is
    # a routine part of running the herd, not the correction of a mistake.
    production_class: ProductionClass | None = None
    dam_id: int | None = None
    sire_id: int | None = None


class HogRead(BaseModel):
    id: int
    farm_id: int
    tag_number: str
    birth_date: date
    breed: str
    sex: HogSex
    production_class: ProductionClass
    status: HogStatus
    dam_id: int | None
    sire_id: int | None
    created_by_user_id: int | None
    updated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
