"""Denormalize farm_id onto child tables; add the hot-path composite indexes.

Every farm-scoped query previously had to JOIN hogs just to find out which farm a
feed/health/breeding/alert row belonged to. Carrying farm_id directly pays for
itself three times: it removes that join from every dashboard query, it makes the
per-farm data-version fingerprint a single-row lookup, and it is what allows
farm-scoped composite indexes to exist at all.

The composite FK against hogs (id, farm_id) is what keeps the denormalization
honest — without it a row could claim a farm its hog does not belong to, which
would be a silent cross-tenant leak.

Revision ID: m2_003
Revises: m1_002
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "m2_003"
down_revision: str | None = "m1_002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, composite-hog-fk, simple-farm-fk) for the tables that hang off a hog.
CHILD_TABLES = [
    ("feed_records", "fk_feed_records_hog_farm", "fk_feed_records_farm"),
    ("health_records", "fk_health_records_hog_farm", "fk_health_records_farm"),
    ("breeding_cycles", "fk_breeding_cycles_hog_farm", "fk_breeding_cycles_farm"),
    ("alerts", "fk_alerts_hog_farm", "fk_alerts_farm"),
]


def upgrade() -> None:
    # Target for the composite FKs below.
    op.create_unique_constraint("uq_hogs_id_farm", "hogs", ["id", "farm_id"])

    for table, hog_fk, farm_fk in CHILD_TABLES:
        # Added nullable, backfilled from the parent hog, then made NOT NULL —
        # the only order that works on a table with existing rows.
        op.add_column(table, sa.Column("farm_id", sa.Integer(), nullable=True))
        op.execute(
            f"UPDATE {table} AS c SET farm_id = h.farm_id FROM hogs AS h WHERE h.id = c.hog_id"
        )
        op.alter_column(table, "farm_id", nullable=False)
        op.create_foreign_key(farm_fk, table, "farms", ["farm_id"], ["id"])
        op.create_foreign_key(hog_fk, table, "hogs", ["hog_id", "farm_id"], ["id", "farm_id"])

    # Hot query shape is `WHERE hog_id = ? AND record_date BETWEEN ? AND ?`, and
    # the dashboard's is the same filtered by farm. Single-column indexes on
    # hog_id alone could not serve either.
    op.create_index("ix_feed_records_hog_date", "feed_records", ["hog_id", "record_date"])
    op.create_index("ix_feed_records_farm_date", "feed_records", ["farm_id", "record_date"])
    op.create_index("ix_health_records_hog_date", "health_records", ["hog_id", "record_date"])
    op.create_index("ix_health_records_farm_date", "health_records", ["farm_id", "record_date"])
    op.create_index("ix_breeding_cycles_farm_start", "breeding_cycles", ["farm_id", "start_date"])
    op.create_index("ix_alerts_farm_status_date", "alerts", ["farm_id", "status", "alert_date"])
    op.create_index("ix_hogs_farm_status", "hogs", ["farm_id", "status"])
    op.create_index("ix_hogs_farm_breed", "hogs", ["farm_id", "breed"])

    # Redundant: each is the leftmost prefix of a composite index created above.
    op.drop_index("ix_feed_records_hog_id", table_name="feed_records")
    op.drop_index("ix_health_records_hog_id", table_name="health_records")
    op.drop_index("ix_alerts_hog_id", table_name="alerts")
    op.drop_index("ix_breeding_cycles_hog_id", table_name="breeding_cycles")


def downgrade() -> None:
    op.create_index("ix_breeding_cycles_hog_id", "breeding_cycles", ["hog_id"])
    op.create_index("ix_alerts_hog_id", "alerts", ["hog_id"])
    op.create_index("ix_health_records_hog_id", "health_records", ["hog_id"])
    op.create_index("ix_feed_records_hog_id", "feed_records", ["hog_id"])

    op.drop_index("ix_hogs_farm_breed", table_name="hogs")
    op.drop_index("ix_hogs_farm_status", table_name="hogs")
    op.drop_index("ix_alerts_farm_status_date", table_name="alerts")
    op.drop_index("ix_breeding_cycles_farm_start", table_name="breeding_cycles")
    op.drop_index("ix_health_records_farm_date", table_name="health_records")
    op.drop_index("ix_health_records_hog_date", table_name="health_records")
    op.drop_index("ix_feed_records_farm_date", table_name="feed_records")
    op.drop_index("ix_feed_records_hog_date", table_name="feed_records")

    for table, hog_fk, farm_fk in reversed(CHILD_TABLES):
        op.drop_constraint(hog_fk, table, type_="foreignkey")
        op.drop_constraint(farm_fk, table, type_="foreignkey")
        op.drop_column(table, "farm_id")

    op.drop_constraint("uq_hogs_id_farm", "hogs", type_="unique")
