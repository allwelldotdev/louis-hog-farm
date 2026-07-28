import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.hog import Hog
    from app.models.user import User


class BreedingStatus(str, enum.Enum):
    ongoing = "ongoing"
    completed = "completed"
    aborted = "aborted"


class BreedingCycle(Base):
    __tablename__ = "breeding_cycles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hog_id: Mapped[int] = mapped_column(ForeignKey("hogs.id"), nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[BreedingStatus] = mapped_column(
        Enum(BreedingStatus, native_enum=False, length=32), nullable=False, default=BreedingStatus.ongoing
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    hog: Mapped["Hog"] = relationship(back_populates="breeding_cycles")
