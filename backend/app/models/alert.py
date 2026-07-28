import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.farm import Farm
    from app.models.hog import Hog
    from app.models.user import User


class AlertType(str, enum.Enum):
    growth_anomaly = "growth_anomaly"
    vaccination_due = "vaccination_due"
    breeding_event = "breeding_event"
    data_gap = "data_gap"


class AlertStatus(str, enum.Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    farm_id: Mapped[int] = mapped_column(ForeignKey("farms.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(64), nullable=False)
    config_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    farm: Mapped["Farm"] = relationship(back_populates="alert_rules")
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="rule")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hog_id: Mapped[int] = mapped_column(ForeignKey("hogs.id"), nullable=False, index=True)
    alert_rule_id: Mapped[int | None] = mapped_column(ForeignKey("alert_rules.id"), nullable=True)
    alert_type: Mapped[AlertType] = mapped_column(
        Enum(AlertType, native_enum=False, length=64), nullable=False, index=True
    )
    alert_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus, native_enum=False, length=32), nullable=False, default=AlertStatus.open
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    hog: Mapped["Hog"] = relationship(back_populates="alerts")
    rule: Mapped["AlertRule | None"] = relationship(back_populates="alerts")
