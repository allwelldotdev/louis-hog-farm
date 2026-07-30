"""Seed profiles and the orchestration that turns a plan into rows."""

import random
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.alert import AlertRule
from app.models.breeding_cycle import BreedingCycle, BreedingStatus
from app.models.farm import Farm
from app.models.feed_record import FeedRecord
from app.models.health_record import HealthRecord
from app.models.hog import Hog, HogStatus, ProductionClass
from app.models.mortality_event import MortalityEvent
from app.models.user import User, UserRole
from app.models.vaccination import Vaccination
from app.seed import generators as gen
from app.seed.writers import bulk_insert, farm_by_name, user_by_email, wipe_farm_data

# Weigh-ins are weekly. Real farms do not weigh every animal every day, and it
# keeps the health table an order of magnitude smaller than the feed table.
WEIGH_EVERY_DAYS = 7

DEMO_FARM_NAME = "Bright Acres Farm"
DEMO_EMAIL = "manager@brightacres.com"
DEMO_PASSWORD = "Bright123!"

MORTALITY_CAUSES = [
    "Scours",
    "Crushing by sow",
    "Respiratory infection",
    "Failure to thrive",
]

EXTRA_FARM_NAMES = [
    "Green Valley Piggery",
    "Riverbend Livestock",
    "Kano Highlands Farm",
    "Oak Ridge Swine Co.",
    "Sunrise Agro Farms",
]


@dataclass(frozen=True)
class SeedResult:
    farm_id: int
    farm_name: str
    hogs: int
    health_records: int
    feed_records: int
    vaccinations: int
    breeding_cycles: int
    mortality_events: int


def ensure_farm(db: Session, name: str, tz: str = "Africa/Lagos") -> Farm:
    farm = farm_by_name(db, name)
    if farm is None:
        farm = Farm(name=name, currency_code="NGN", timezone=tz)
        db.add(farm)
        db.commit()
        db.refresh(farm)
    return farm


def ensure_manager(db: Session, farm: Farm, email: str, full_name: str) -> User:
    user = user_by_email(db, email)
    if user is None:
        user = User(
            farm_id=farm.id,
            email=email,
            password_hash=hash_password(DEMO_PASSWORD),
            full_name=full_name,
            role=UserRole.manager,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def ensure_alert_rules(db: Session, farm: Farm) -> None:
    if db.scalar(select(AlertRule).where(AlertRule.farm_id == farm.id)) is not None:
        return
    for name, rule_type in [
        ("Weight loss over 14 days", "growth_anomaly"),
        ("Vaccination due within 14 days", "vaccination_due"),
        ("No weight record for 10 days", "data_gap"),
    ]:
        db.add(AlertRule(farm_id=farm.id, name=name, rule_type=rule_type, is_active=True))
    db.commit()


def seed_farm(
    db: Session,
    farm_name: str,
    manager_email: str,
    manager_name: str,
    hog_count: int,
    days: int,
    rng_seed: int,
    tag_prefix: str,
    reset: bool,
) -> SeedResult:
    rng = random.Random(rng_seed)

    farm = ensure_farm(db, farm_name)
    manager = ensure_manager(db, farm, manager_email, manager_name)
    ensure_alert_rules(db, farm)
    if reset:
        wipe_farm_data(db, farm.id)

    today = date.today()
    start = today - timedelta(days=days - 1)
    plans = gen.plan_herd(rng, hog_count, days, tag_prefix)

    # Hogs first — the record rows need their ids.
    hog_rows: list[dict[str, Any]] = []
    for p in plans:
        died = p.death_day is not None
        hog_rows.append(
            {
                "farm_id": farm.id,
                "tag_number": p.tag_number,
                "birth_date": p.birth_date,
                "breed": p.breed,
                "sex": p.sex,
                "production_class": p.production_class,
                "status": HogStatus.deceased if died else HogStatus.active,
                "created_by_user_id": manager.id,
                "updated_by_user_id": manager.id,
            }
        )
    bulk_insert(db, Hog, hog_rows)

    tag_rows = db.execute(select(Hog.tag_number, Hog.id).where(Hog.farm_id == farm.id)).all()
    id_by_tag: dict[str, int] = {row[0]: row[1] for row in tag_rows}

    health_rows: list[dict[str, Any]] = []
    feed_rows: list[dict[str, Any]] = []
    vacc_rows: list[dict[str, Any]] = []
    mortality_rows: list[dict[str, Any]] = []
    breeding_rows: list[dict[str, Any]] = []

    for plan in plans:
        hog_id = id_by_tag[plan.tag_number]
        series = gen.build_series(plan, start, days, rng)

        for point in series.points:
            feed_rows.append(
                {
                    "hog_id": hog_id,
                    "farm_id": farm.id,
                    "feed_amount": round(point.feed_kg, 4),
                    "feed_cost": round(point.feed_cost, 2),
                    "currency_code": farm.currency_code,
                    "record_date": point.on,
                    "created_by_user_id": manager.id,
                    "updated_by_user_id": manager.id,
                }
            )
            # Weigh weekly, plus always capture the final day so the latest
            # weight is current for market-readiness.
            is_last = point.day_index == series.points[-1].day_index
            if point.day_index % WEIGH_EVERY_DAYS == 0 or is_last:
                health_rows.append(
                    {
                        "hog_id": hog_id,
                        "farm_id": farm.id,
                        "weight": round(point.weight_kg, 3),
                        "temperature": round(point.temperature_c, 2),
                        "notes": point.note or "Routine check",
                        "record_date": point.on,
                        "created_by_user_id": manager.id,
                        "updated_by_user_id": manager.id,
                    }
                )

        for dose_date, vaccine, next_due in gen.vaccination_plan(plan, start, days):
            vacc_rows.append(
                {
                    "hog_id": hog_id,
                    "farm_id": farm.id,
                    "vaccine_name": vaccine,
                    "dose_date": dose_date,
                    "next_due_date": next_due,
                    "created_by_user_id": manager.id,
                    "updated_by_user_id": manager.id,
                }
            )

        if plan.death_day is not None:
            mortality_rows.append(
                {
                    "hog_id": hog_id,
                    "farm_id": farm.id,
                    "event_date": start + timedelta(days=plan.death_day),
                    "cause": rng.choice(MORTALITY_CAUSES),
                    "notes": "Recorded during routine inspection",
                    "created_by_user_id": manager.id,
                    "updated_by_user_id": manager.id,
                }
            )

        if plan.production_class in (ProductionClass.sow, ProductionClass.gilt):
            cycle_start = start + timedelta(days=rng.randint(0, max(1, days // 3)))
            farrow = cycle_start + timedelta(days=gen.GESTATION_DAYS)
            completed = farrow <= today
            breeding_rows.append(
                {
                    "hog_id": hog_id,
                    "farm_id": farm.id,
                    "start_date": cycle_start,
                    "end_date": farrow if completed else None,
                    "status": BreedingStatus.completed if completed else BreedingStatus.ongoing,
                    "notes": f"Service recorded {cycle_start.isoformat()}",
                    "created_by_user_id": manager.id,
                    "updated_by_user_id": manager.id,
                }
            )

    bulk_insert(db, HealthRecord, health_rows)
    bulk_insert(db, FeedRecord, feed_rows)
    bulk_insert(db, Vaccination, vacc_rows)
    bulk_insert(db, MortalityEvent, mortality_rows)
    bulk_insert(db, BreedingCycle, breeding_rows)

    return SeedResult(
        farm_id=farm.id,
        farm_name=farm.name,
        hogs=len(hog_rows),
        health_records=len(health_rows),
        feed_records=len(feed_rows),
        vaccinations=len(vacc_rows),
        breeding_cycles=len(breeding_rows),
        mortality_events=len(mortality_rows),
    )
