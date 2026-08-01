from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.alert import AlertRule
from app.models.hog import Hog
from app.models.user import User


def get_hog_in_farm(db: Session, hog_id: int, farm_id: int) -> Hog:
    hog = db.get(Hog, hog_id)
    if hog is None or hog.farm_id != farm_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hog not found")
    return hog


def get_user_in_farm(db: Session, user_id: int, farm_id: int) -> User:
    """404 rather than 403 for a colleague on another farm — a 403 confirms the
    account exists, which is the one thing a cross-farm probe is looking for."""
    user = db.get(User, user_id)
    if user is None or user.farm_id != farm_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def get_alert_rule_in_farm(db: Session, rule_id: int, farm_id: int) -> AlertRule:
    rule = db.get(AlertRule, rule_id)
    if rule is None or rule.farm_id != farm_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    return rule
