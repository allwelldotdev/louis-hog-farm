"""Bulk insert helpers.

Rows go in via chunked Core `insert()` rather than per-row ORM adds. Besides
being an order of magnitude faster, it keeps the statement-level data-version
triggers to a handful of firings instead of one per row.
"""

from typing import Any

from sqlalchemy import delete, insert, select, update
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.breeding_cycle import BreedingCycle
from app.models.data_version import DataVersion
from app.models.farm import Farm
from app.models.feed_record import FeedRecord
from app.models.health_record import HealthRecord
from app.models.hog import Hog
from app.models.mortality_event import MortalityEvent
from app.models.user import User
from app.models.vaccination import Vaccination

CHUNK = 5000

# Order matters: children before parents. Typed as the concrete models so the
# shared `farm_id` column is visible to the type checker.
_WIPE_ORDER: list[type[Any]] = [
    Alert,
    Vaccination,
    MortalityEvent,
    BreedingCycle,
    FeedRecord,
    HealthRecord,
    Hog,
]


def bulk_insert(db: Session, model: type[Any], rows: list[dict[str, Any]]) -> int:
    for start in range(0, len(rows), CHUNK):
        db.execute(insert(model), rows[start : start + CHUNK])
    db.commit()
    return len(rows)


def wipe_farm_data(db: Session, farm_id: int) -> None:
    """Remove a farm's records but keep the farm, its users and its rules."""
    for model in _WIPE_ORDER:
        db.execute(delete(model).where(model.farm_id == farm_id))
    # Bump explicitly: the triggers fire on the record tables, but a wipe that
    # deletes nothing would otherwise leave clients on a stale cached version.
    db.execute(
        update(DataVersion)
        .where(DataVersion.farm_id == farm_id)
        .values(version=DataVersion.version + 1)
    )
    db.commit()


def farm_by_name(db: Session, name: str) -> Farm | None:
    return db.scalar(select(Farm).where(Farm.name == name))


def user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))
