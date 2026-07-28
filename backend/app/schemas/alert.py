from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.alert import AlertStatus, AlertType


class AlertRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    rule_type: str = Field(min_length=1, max_length=64)
    config_json: str | None = None
    is_active: bool = True


class AlertRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    rule_type: str | None = Field(default=None, min_length=1, max_length=64)
    config_json: str | None = None
    is_active: bool | None = None


class AlertRuleRead(BaseModel):
    id: int
    farm_id: int
    name: str
    rule_type: str
    config_json: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertCreate(BaseModel):
    hog_id: int
    alert_type: AlertType
    alert_date: date
    message: str = Field(min_length=1)
    alert_rule_id: int | None = None


class AlertUpdate(BaseModel):
    status: AlertStatus | None = None
    resolution_notes: str | None = None


class AlertRead(BaseModel):
    id: int
    hog_id: int
    alert_rule_id: int | None
    alert_type: AlertType
    alert_date: date
    message: str
    status: AlertStatus
    resolution_notes: str | None
    created_by_user_id: int | None
    updated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
