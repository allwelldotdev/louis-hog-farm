from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.alert import AlertRule
    from app.models.hog import Hog
    from app.models.user import User


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Currency lives on the farm, not on each feed record. Per-record currency
    # allowed a farm to accumulate mixed currencies, which made the dashboard
    # null out every cost KPI (audit i). The platform is single-currency (NGN)
    # for now; this column is what a future per-farm currency picker and FX
    # conversion would hang off, so it exists rather than being hardcoded.
    currency_code: Mapped[str] = mapped_column(
        String(3), nullable=False, server_default="NGN", default="NGN"
    )
    # IANA zone. "Today" must be evaluated in the farm's local time: for a farm
    # at UTC+1, a same-day entry made after 23:00 local is otherwise rejected as
    # being in the future.
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default="UTC", default="UTC"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    users: Mapped[list["User"]] = relationship(back_populates="farm")
    hogs: Mapped[list["Hog"]] = relationship(back_populates="farm")
    alert_rules: Mapped[list["AlertRule"]] = relationship("AlertRule", back_populates="farm")
