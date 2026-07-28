from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, ManagerUser
from app.db.session import get_db
from app.models.alert import AlertRule
from app.schemas.alert import AlertRuleCreate, AlertRuleRead, AlertRuleUpdate

router = APIRouter(prefix="/alert-rules", tags=["alert-rules"])


@router.get("", response_model=list[AlertRuleRead])
def list_alert_rules(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
) -> list[AlertRule]:
    stmt = select(AlertRule).where(AlertRule.farm_id == user.farm_id).order_by(AlertRule.id)
    return list(db.scalars(stmt).all())


@router.post("", response_model=AlertRuleRead, status_code=status.HTTP_201_CREATED)
def create_alert_rule(
    db: Annotated[Session, Depends(get_db)],
    user: ManagerUser,
    body: AlertRuleCreate,
) -> AlertRule:
    rule = AlertRule(
        farm_id=user.farm_id,
        name=body.name,
        rule_type=body.rule_type,
        config_json=body.config_json,
        is_active=body.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/{rule_id}", response_model=AlertRuleRead)
def get_alert_rule(
    db: Annotated[Session, Depends(get_db)],
    user: CurrentUser,
    rule_id: int,
) -> AlertRule:
    rule = db.get(AlertRule, rule_id)
    if rule is None or rule.farm_id != user.farm_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    return rule


@router.patch("/{rule_id}", response_model=AlertRuleRead)
def update_alert_rule(
    db: Annotated[Session, Depends(get_db)],
    user: ManagerUser,
    rule_id: int,
    body: AlertRuleUpdate,
) -> AlertRule:
    rule = db.get(AlertRule, rule_id)
    if rule is None or rule.farm_id != user.farm_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    if body.name is not None:
        rule.name = body.name
    if body.rule_type is not None:
        rule.rule_type = body.rule_type
    if body.config_json is not None:
        rule.config_json = body.config_json
    if body.is_active is not None:
        rule.is_active = body.is_active
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule
