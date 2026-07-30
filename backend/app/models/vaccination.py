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


class Vaccination(Base):
    """A dose administered, with the date the next one falls due.

    `AlertType.vaccination_due` existed in the enum with nothing in the schema
    able to generate it. `next_due_date` is what makes that alert type real.
    """

    __tablename__ = "vaccinations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["hog_id", "farm_id"],
            ["hogs.id", "hogs.farm_id"],
            name="fk_vaccinations_hog_farm",
        ),
        Index("ix_vaccinations_hog_date", "hog_id", "dose_date"),
        Index("ix_vaccinations_farm_due", "farm_id", "next_due_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hog_id: Mapped[int] = mapped_column(ForeignKey("hogs.id"), nullable=False)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False)
    vaccine_name: Mapped[str] = mapped_column(String(128), nullable=False)
    dose_date: Mapped[date] = mapped_column(Date, nullable=False)
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    hog: Mapped["Hog"] = relationship(back_populates="vaccinations", foreign_keys=[hog_id])
