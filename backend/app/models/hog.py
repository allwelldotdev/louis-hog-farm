import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.alert import Alert
    from app.models.breeding_cycle import BreedingCycle
    from app.models.farm import Farm
    from app.models.feed_record import FeedRecord
    from app.models.health_record import HealthRecord


class HogStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


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
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    tag_number: Mapped[str] = mapped_column(String(64), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    breed: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[HogStatus] = mapped_column(
        Enum(HogStatus, native_enum=False, length=32), nullable=False, default=HogStatus.active
    )
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    farm: Mapped["Farm"] = relationship(back_populates="hogs")
    feed_records: Mapped[list["FeedRecord"]] = relationship(back_populates="hog")
    health_records: Mapped[list["HealthRecord"]] = relationship(back_populates="hog")
    breeding_cycles: Mapped[list["BreedingCycle"]] = relationship(back_populates="hog")
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="hog")
