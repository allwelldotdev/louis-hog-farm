from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.alert import AlertRule
from app.models.hog import Hog


def get_hog_in_farm(db: Session, hog_id: int, farm_id: int) -> Hog:
    hog = db.get(Hog, hog_id)
    if hog is None or hog.farm_id != farm_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hog not found")
    return hog


def get_alert_rule_in_farm(db: Session, rule_id: int, farm_id: int) -> AlertRule:
    rule = db.get(AlertRule, rule_id)
    if rule is None or rule.farm_id != farm_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    return rule
