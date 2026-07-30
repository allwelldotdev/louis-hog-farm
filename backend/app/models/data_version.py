from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DataVersion(Base):
    """Per-farm change counter driving browser cache invalidation.

    One row per farm, bumped by statement-level triggers on every table the
    dashboard reads (see the m4_005 migration). The dashboard polls
    `GET /meta/data-version` — a single primary-key lookup — and invalidates its
    cached queries when the number moves.

    Triggers rather than an application-level SQLAlchemy event for two reasons:
    a statement-level trigger with transition tables fires once per statement,
    so a bulk seed of 27,000 rows bumps the counter a handful of times instead
    of 27,000; and it catches *every* writer, including someone editing a row
    directly in psql, which an ORM hook cannot see.
    """

    __tablename__ = "data_versions"

    farm_id: Mapped[int] = mapped_column(
        ForeignKey("farms.id", ondelete="CASCADE"), primary_key=True
    )
    version: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
