from datetime import date, timedelta
from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.farm import Farm
from app.models.feed_record import FeedRecord
from app.models.health_record import HealthRecord
from app.models.hog import Hog, HogStatus
from app.models.user import User, UserRole


def seed_demo_data() -> dict[str, int]:
    db: Session = SessionLocal()
    try:
        farm = db.scalar(select(Farm).where(Farm.name == "Bright Acres Farm"))
        if farm is None:
            farm = Farm(name="Bright Acres Farm")
            db.add(farm)
            db.flush()

        manager = db.scalar(select(User).where(User.email == "manager@brightacres.com"))
        if manager is None:
            manager = User(
                farm_id=farm.id,
                email="manager@brightacres.com",
                password_hash=hash_password("Bright123!"),
                full_name="Ava Thompson",
                role=UserRole.manager,
                is_active=True,
            )
            db.add(manager)
            db.flush()
        else:
            manager.farm_id = farm.id
            manager.full_name = "Ava Thompson"
            manager.role = UserRole.manager
            manager.is_active = True
            db.add(manager)

        hog_specs = [
            {"tag_number": "H-1001", "birth_date": date(2024, 2, 10), "breed": "Large White"},
            {"tag_number": "H-1002", "birth_date": date(2024, 3, 4), "breed": "Landrace"},
            {"tag_number": "H-1003", "birth_date": date(2024, 1, 22), "breed": "Duroc"},
            {"tag_number": "H-1004", "birth_date": date(2024, 4, 18), "breed": "Berkshire"},
            {"tag_number": "H-1005", "birth_date": date(2024, 5, 2), "breed": "Tamworth"},
            {"tag_number": "H-1006", "birth_date": date(2024, 5, 21), "breed": "Pietrain"},
        ]

        created_hogs = []
        for spec in hog_specs:
            hog = db.scalar(
                select(Hog).where(Hog.farm_id == farm.id, Hog.tag_number == spec["tag_number"])
            )
            if hog is None:
                hog = Hog(
                    farm_id=farm.id,
                    tag_number=spec["tag_number"],
                    birth_date=spec["birth_date"],
                    breed=spec["breed"],
                    status=HogStatus.active,
                    created_by_user_id=manager.id,
                    updated_by_user_id=manager.id,
                )
                db.add(hog)
                db.flush()
            else:
                hog.birth_date = cast(date, spec["birth_date"])
                hog.breed = cast(str, spec["breed"])
                hog.status = HogStatus.active
                hog.updated_by_user_id = manager.id
                db.add(hog)
            created_hogs.append(hog)

        for hog in created_hogs:
            feed_series = [
                (0, 4.5, 4500),
                (3, 4.7, 4500),
                (7, 4.2, 4500),
                (10, 4.9, 4500),
                (14, 4.8, 4500),
                (21, 5.1, 4500),
            ]
            for offset, feed_amount, feed_cost in feed_series:
                record_date = date.today() - timedelta(days=offset)
                existing_feed = db.scalar(
                    select(FeedRecord).where(
                        FeedRecord.hog_id == hog.id,
                        FeedRecord.record_date == record_date,
                    )
                )
                if existing_feed is None:
                    db.add(
                        FeedRecord(
                            hog_id=hog.id,
                            farm_id=farm.id,
                            feed_amount=feed_amount,
                            feed_cost=feed_cost,
                            currency_code=farm.currency_code,
                            record_date=record_date,
                            created_by_user_id=manager.id,
                            updated_by_user_id=manager.id,
                        )
                    )

            health_series = [
                (0, 82.4, 39.2, "Routine check-in"),
                (3, 83.1, 39.0, "Steady appetite"),
                (7, 84.1, 39.0, "Routine check-in"),
                (10, 85.0, 38.9, "Mobility observed"),
                (14, 86.0, 38.8, "Routine check-in"),
                (21, 87.2, 39.1, "Weight gain noted"),
            ]
            for offset, weight, temperature, notes in health_series:
                record_date = date.today() - timedelta(days=offset)
                existing_health = db.scalar(
                    select(HealthRecord).where(
                        HealthRecord.hog_id == hog.id,
                        HealthRecord.record_date == record_date,
                    )
                )
                if existing_health is None:
                    db.add(
                        HealthRecord(
                            hog_id=hog.id,
                            farm_id=farm.id,
                            weight=weight,
                            temperature=temperature,
                            notes=notes,
                            record_date=record_date,
                            created_by_user_id=manager.id,
                            updated_by_user_id=manager.id,
                        )
                    )

        db.commit()
        return {
            "farm_id": farm.id,
            "user_id": manager.id,
            "hog_count": len(created_hogs),
        }
    finally:
        db.close()


if __name__ == "__main__":
    result = seed_demo_data()
    print(result)
