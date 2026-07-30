from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.hog import Hog


class FeedRecord(Base):
    __tablename__ = "feed_records"
    __table_args__ = (
        # Composite FK against hogs (id, farm_id): the denormalized farm_id
        # cannot disagree with the hog's actual farm. Denormalizing without this
        # is a tenant-leak waiting to happen.
        ForeignKeyConstraint(
            ["hog_id", "farm_id"],
            ["hogs.id", "hogs.farm_id"],
            name="fk_feed_records_hog_farm",
        ),
        Index("ix_feed_records_hog_date", "hog_id", "record_date"),
        Index("ix_feed_records_farm_date", "farm_id", "record_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hog_id: Mapped[int] = mapped_column(ForeignKey("hogs.id"), nullable=False)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False)
    feed_amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    feed_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    # Retained for historical accuracy if a farm ever changes currency, but the
    # API no longer accepts it — it is filled from farm.currency_code on write.
    currency_code: Mapped[str] = mapped_column(
        String(3), nullable=False, server_default="NGN", default="NGN"
    )
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    hog: Mapped["Hog"] = relationship(back_populates="feed_records", foreign_keys=[hog_id])
