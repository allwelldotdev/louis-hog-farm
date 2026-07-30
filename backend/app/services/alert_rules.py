"""Alert rule evaluation.

`AlertRule` rows were stored but never evaluated — nothing in the codebase ever
produced an `Alert`, so the table only ever held manually POSTed rows and
`AlertType.vaccination_due` was unreachable by construction.

This is the evaluator. The seeder runs it over generated data rather than
fabricating alert rows, so what the dashboard shows is the rule engine's actual
output.
"""

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert, AlertStatus, AlertType
from app.models.health_record import HealthRecord
from app.models.hog import Hog, HogStatus
from app.models.vaccination import Vaccination

# Defaults chosen to be defensible rather than tuned: a pig losing weight over a
# week is always worth a look, and a week without a weigh-in is a real data gap.
GROWTH_ANOMALY_ADG_FLOOR = 0.0
GROWTH_ANOMALY_WINDOW_DAYS = 14
DATA_GAP_DAYS = 10
VACCINATION_DUE_LOOKAHEAD_DAYS = 14


@dataclass(frozen=True)
class ProposedAlert:
    hog_id: int
    farm_id: int
    alert_type: AlertType
    alert_date: date
    message: str


def evaluate_growth_anomalies(db: Session, farm_id: int, as_of: date) -> list[ProposedAlert]:
    """Flag hogs whose weight fell over the recent window."""
    window_start = as_of - timedelta(days=GROWTH_ANOMALY_WINDOW_DAYS)
    first = (
        select(HealthRecord.hog_id, HealthRecord.weight)
        .where(
            HealthRecord.farm_id == farm_id,
            HealthRecord.record_date >= window_start,
            HealthRecord.record_date <= as_of,
        )
        .order_by(HealthRecord.hog_id, HealthRecord.record_date.asc(), HealthRecord.id.asc())
        .distinct(HealthRecord.hog_id)
        .subquery("first_w")
    )
    last = (
        select(HealthRecord.hog_id, HealthRecord.weight)
        .where(
            HealthRecord.farm_id == farm_id,
            HealthRecord.record_date >= window_start,
            HealthRecord.record_date <= as_of,
        )
        .order_by(HealthRecord.hog_id, HealthRecord.record_date.desc(), HealthRecord.id.desc())
        .distinct(HealthRecord.hog_id)
        .subquery("last_w")
    )
    rows = db.execute(
        select(Hog.id, Hog.tag_number, first.c.weight, last.c.weight)
        .join(first, first.c.hog_id == Hog.id)
        .join(last, last.c.hog_id == Hog.id)
        .where(Hog.farm_id == farm_id, Hog.status == HogStatus.active)
    ).all()

    out: list[ProposedAlert] = []
    for hog_id, tag, w_first, w_last in rows:
        gain = float(w_last) - float(w_first)
        adg = gain / GROWTH_ANOMALY_WINDOW_DAYS
        if adg <= GROWTH_ANOMALY_ADG_FLOOR:
            out.append(
                ProposedAlert(
                    hog_id=hog_id,
                    farm_id=farm_id,
                    alert_type=AlertType.growth_anomaly,
                    alert_date=as_of,
                    message=(
                        f"{tag} lost {abs(gain):.1f} kg over the last "
                        f"{GROWTH_ANOMALY_WINDOW_DAYS} days ({adg:+.2f} kg/day)"
                    ),
                )
            )
    return out


def evaluate_vaccinations_due(db: Session, farm_id: int, as_of: date) -> list[ProposedAlert]:
    horizon = as_of + timedelta(days=VACCINATION_DUE_LOOKAHEAD_DAYS)
    latest = (
        select(Vaccination.hog_id, func.max(Vaccination.next_due_date).label("due"))
        .where(Vaccination.farm_id == farm_id, Vaccination.next_due_date.is_not(None))
        .group_by(Vaccination.hog_id)
        .subquery("due")
    )
    rows = db.execute(
        select(Hog.id, Hog.tag_number, latest.c.due)
        .join(latest, latest.c.hog_id == Hog.id)
        .where(
            Hog.farm_id == farm_id,
            Hog.status == HogStatus.active,
            latest.c.due <= horizon,
        )
    ).all()
    return [
        ProposedAlert(
            hog_id=hog_id,
            farm_id=farm_id,
            alert_type=AlertType.vaccination_due,
            alert_date=as_of,
            message=f"{tag} vaccination due {due.isoformat()}",
        )
        for hog_id, tag, due in rows
    ]


def evaluate_data_gaps(db: Session, farm_id: int, as_of: date) -> list[ProposedAlert]:
    cutoff = as_of - timedelta(days=DATA_GAP_DAYS)
    latest = (
        select(
            HealthRecord.hog_id,
            func.max(HealthRecord.record_date).label("last_seen"),
        )
        .where(HealthRecord.farm_id == farm_id)
        .group_by(HealthRecord.hog_id)
        .subquery("last_seen")
    )
    rows = db.execute(
        select(Hog.id, Hog.tag_number, latest.c.last_seen)
        .outerjoin(latest, latest.c.hog_id == Hog.id)
        .where(Hog.farm_id == farm_id, Hog.status == HogStatus.active)
    ).all()
    out: list[ProposedAlert] = []
    for hog_id, tag, last_seen in rows:
        if last_seen is None or last_seen < cutoff:
            seen = "never" if last_seen is None else last_seen.isoformat()
            out.append(
                ProposedAlert(
                    hog_id=hog_id,
                    farm_id=farm_id,
                    alert_type=AlertType.data_gap,
                    alert_date=as_of,
                    message=f"{tag} has no weight record since {seen}",
                )
            )
    return out


def evaluate_farm(db: Session, farm_id: int, as_of: date) -> list[ProposedAlert]:
    return [
        *evaluate_growth_anomalies(db, farm_id, as_of),
        *evaluate_vaccinations_due(db, farm_id, as_of),
        *evaluate_data_gaps(db, farm_id, as_of),
    ]


def materialise(db: Session, proposals: list[ProposedAlert]) -> int:
    """Insert proposals that are not already open for the same hog and type."""
    existing = {
        (hog_id, alert_type)
        for hog_id, alert_type in db.execute(
            select(Alert.hog_id, Alert.alert_type).where(Alert.status == AlertStatus.open)
        ).all()
    }
    created = 0
    for p in proposals:
        if (p.hog_id, p.alert_type) in existing:
            continue
        db.add(
            Alert(
                hog_id=p.hog_id,
                farm_id=p.farm_id,
                alert_type=p.alert_type,
                alert_date=p.alert_date,
                message=p.message,
                status=AlertStatus.open,
            )
        )
        existing.add((p.hog_id, p.alert_type))
        created += 1
    db.commit()
    return created
