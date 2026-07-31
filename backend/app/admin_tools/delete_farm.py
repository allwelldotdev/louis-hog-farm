"""Delete a farm and every row that references it.

    python -m app.admin_tools.delete_farm --name "Acme Test Farm"
    python -m app.admin_tools.delete_farm --id 7 --yes

There is no ON DELETE CASCADE from farms to its child tables (hogs, records,
users, ...), so this walks the same child-before-parent order the seeder uses
in app.seed.writers.wipe_farm_data, then removes the users and the farm row
itself. data_versions is the one table that does cascade at the DB level, so
it needs no explicit delete here.

Prints row counts and asks for confirmation before deleting anything, unless
--yes is passed.
"""

import argparse
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.alert import Alert, AlertRule
from app.models.breeding_cycle import BreedingCycle
from app.models.farm import Farm
from app.models.feed_record import FeedRecord
from app.models.health_record import HealthRecord
from app.models.hog import Hog
from app.models.mortality_event import MortalityEvent
from app.models.user import User
from app.models.vaccination import Vaccination

# Children before parents. Alert precedes AlertRule because alerts.alert_rule_id
# references alert_rules.id. Users go last among children because every record
# table has a nullable FK to users.id (created_by_user_id / updated_by_user_id).
_DELETE_ORDER: list[type[Any]] = [
    Alert,
    AlertRule,
    Vaccination,
    MortalityEvent,
    BreedingCycle,
    FeedRecord,
    HealthRecord,
    Hog,
    User,
]


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="python -m app.admin_tools.delete_farm", description=__doc__)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--id", type=int, help="farm id to delete")
    g.add_argument("--name", type=str, help="exact farm name to delete")
    p.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    return p.parse_args()


def _find_farm(db: Session, args: argparse.Namespace) -> Farm:
    if args.id is not None:
        farm = db.get(Farm, args.id)
        if farm is None:
            raise SystemExit(f"No farm with id {args.id}")
        return farm
    farm = db.scalar(select(Farm).where(Farm.name == args.name))
    if farm is None:
        raise SystemExit(f"No farm named {args.name!r}")
    return farm


def _counts(db: Session, farm_id: int) -> dict[str, int]:
    counts: dict[str, int] = {}
    models: list[type[Any]] = [*_DELETE_ORDER, Farm]
    for model in models:
        table_name = model.__tablename__
        id_col = Farm.id if model is Farm else model.farm_id
        counts[table_name] = (
            db.scalar(select(func.count()).select_from(model).where(id_col == farm_id)) or 0
        )
    return counts


def main() -> None:
    args = _parse_args()
    with SessionLocal() as db:
        farm = _find_farm(db, args)
        counts = _counts(db, farm.id)

        print(f"\nFarm {farm.id} — {farm.name!r}\n")
        for table_name, n in counts.items():
            print(f"  {table_name:<16} {n}")

        if not args.yes:
            reply = input(f"\nDelete farm {farm.id} and all rows above? [y/N] ")
            if reply.strip().lower() != "y":
                print("Aborted — nothing deleted.")
                return

        for model in _DELETE_ORDER:
            db.execute(delete(model).where(model.farm_id == farm.id))
        db.execute(delete(Farm).where(Farm.id == farm.id))
        db.commit()

        print(f"\nDeleted farm {farm.id} ({farm.name!r}).\n")


if __name__ == "__main__":
    main()
