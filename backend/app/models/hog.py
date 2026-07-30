import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.alert import Alert
    from app.models.breeding_cycle import BreedingCycle
    from app.models.farm import Farm
    from app.models.feed_record import FeedRecord
    from app.models.health_record import HealthRecord
    from app.models.mortality_event import MortalityEvent
    from app.models.vaccination import Vaccination


class HogStatus(str, enum.Enum):
    active = "active"
    archived = "archived"
    # Distinct from archived: archived means sold or otherwise removed from the
    # herd, deceased means died. Mortality rate is a headline pig-farm KPI and
    # cannot be computed if the two are conflated.
    deceased = "deceased"


class HogSex(str, enum.Enum):
    male = "male"
    female = "female"


class ProductionClass(str, enum.Enum):
    """Where the animal sits in the production cycle.

    Orthogonal to sex — a `female` may be a piglet, a gilt or a sow. Drives
    expected growth rate, vaccination schedule, and whether a breeding cycle is
    valid for the animal at all.
    """

    piglet = "piglet"
    weaner = "weaner"
    grower = "grower"
    finisher = "finisher"
    gilt = "gilt"
    sow = "sow"
    boar = "boar"


# Only these may carry a breeding cycle. Previously any hog could, including a
# piglet or a barrow.
BREEDING_CLASSES = (ProductionClass.sow, ProductionClass.gilt)


class Hog(Base):
    __tablename__ = "hogs"
    __table_args__ = (
        Index(
            "uq_hogs_farm_tag_active",
            "farm_id",
            "tag_number",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        # Target of the composite FKs on the child tables, which is what stops a
        # child row claiming a farm its hog does not belong to.
        UniqueConstraint("id", "farm_id", name="uq_hogs_id_farm"),
        Index("ix_hogs_farm_status", "farm_id", "status"),
        Index("ix_hogs_farm_breed", "farm_id", "breed"),
        Index("ix_hogs_farm_class", "farm_id", "production_class"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    tag_number: Mapped[str] = mapped_column(String(64), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    breed: Mapped[str] = mapped_column(String(128), nullable=False)
    sex: Mapped[HogSex] = mapped_column(
        Enum(HogSex, native_enum=False, length=16),
        nullable=False,
        default=HogSex.female,
        server_default="female",
    )
    production_class: Mapped[ProductionClass] = mapped_column(
        Enum(ProductionClass, native_enum=False, length=32),
        nullable=False,
        default=ProductionClass.piglet,
        server_default="piglet",
    )
    status: Mapped[HogStatus] = mapped_column(
        Enum(HogStatus, native_enum=False, length=32),
        nullable=False,
        default=HogStatus.active,
        server_default="active",
    )
    # Lineage. Without these a farrowing produces unrelated animals and the
    # breeding data is decorative; with them a litter is coherent.
    dam_id: Mapped[int | None] = mapped_column(ForeignKey("hogs.id"), nullable=True)
    sire_id: Mapped[int | None] = mapped_column(ForeignKey("hogs.id"), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    farm: Mapped["Farm"] = relationship(back_populates="hogs")
    feed_records: Mapped[list["FeedRecord"]] = relationship(
        back_populates="hog", foreign_keys="FeedRecord.hog_id"
    )
    health_records: Mapped[list["HealthRecord"]] = relationship(
        back_populates="hog", foreign_keys="HealthRecord.hog_id"
    )
    breeding_cycles: Mapped[list["BreedingCycle"]] = relationship(
        back_populates="hog", foreign_keys="BreedingCycle.hog_id"
    )
    alerts: Mapped[list["Alert"]] = relationship(
        "Alert", back_populates="hog", foreign_keys="Alert.hog_id"
    )
    vaccinations: Mapped[list["Vaccination"]] = relationship(
        back_populates="hog", foreign_keys="Vaccination.hog_id"
    )
    mortality_event: Mapped["MortalityEvent | None"] = relationship(
        back_populates="hog", foreign_keys="MortalityEvent.hog_id"
    )
    dam: Mapped["Hog | None"] = relationship("Hog", remote_side=[id], foreign_keys=[dam_id])
    sire: Mapped["Hog | None"] = relationship("Hog", remote_side=[id], foreign_keys=[sire_id])
