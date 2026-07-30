from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.hog import Hog


class MortalityEvent(Base):
    """A death. One per hog, paired with setting the hog's status to `deceased`.

    Mortality rate is one of the two headline KPIs for a piggery and is named
    explicitly in the project description, but there was previously nowhere to
    record a death at all — `archived` conflated "sold" with "died".
    """

    __tablename__ = "mortality_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["hog_id", "farm_id"],
            ["hogs.id", "hogs.farm_id"],
            name="fk_mortality_events_hog_farm",
        ),
        Index("ix_mortality_events_farm_date", "farm_id", "event_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Unique: a hog can only die once, which also makes the relationship scalar.
    hog_id: Mapped[int] = mapped_column(ForeignKey("hogs.id"), nullable=False, unique=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    cause: Mapped[str] = mapped_column(String(128), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    hog: Mapped["Hog"] = relationship(back_populates="mortality_event", foreign_keys=[hog_id])
