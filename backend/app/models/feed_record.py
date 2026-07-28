from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.hog import Hog
    from app.models.user import User


class FeedRecord(Base):
    __tablename__ = "feed_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hog_id: Mapped[int] = mapped_column(ForeignKey("hogs.id"), nullable=False, index=True)
    feed_amount: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    feed_cost: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="GBP")
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    hog: Mapped["Hog"] = relationship(back_populates="feed_records")
