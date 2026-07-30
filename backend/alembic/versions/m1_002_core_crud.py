"""m1 core crud tables and hog tag partial unique

Revision ID: m1_002
Revises: m0_001
Create Date: 2026-05-14

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "m1_002"
down_revision: str | None = "m0_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_hog_farm_tag", "hogs", type_="unique")
    op.create_index(
        "uq_hogs_farm_tag_active",
        "hogs",
        ["farm_id", "tag_number"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    op.add_column("hogs", sa.Column("updated_by_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_hogs_updated_by_user_id", "hogs", "users", ["updated_by_user_id"], ["id"]
    )

    op.create_table(
        "alert_rules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("farm_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("rule_type", sa.String(length=64), nullable=False),
        sa.Column("config_json", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alert_rules_farm_id"), "alert_rules", ["farm_id"], unique=False)

    op.create_table(
        "feed_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("hog_id", sa.Integer(), nullable=False),
        sa.Column("feed_amount", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("feed_cost", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("currency_code", sa.String(length=3), nullable=False, server_default="GBP"),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("feed_amount >= 0", name="ck_feed_records_amount_nonneg"),
        sa.CheckConstraint("feed_cost >= 0", name="ck_feed_records_cost_nonneg"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["hog_id"], ["hogs.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_feed_records_hog_id"), "feed_records", ["hog_id"], unique=False)
    op.create_index(
        op.f("ix_feed_records_record_date"), "feed_records", ["record_date"], unique=False
    )

    op.create_table(
        "health_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("hog_id", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column("temperature", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("weight > 0", name="ck_health_records_weight_pos"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["hog_id"], ["hogs.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_health_records_hog_id"), "health_records", ["hog_id"], unique=False)
    op.create_index(
        op.f("ix_health_records_record_date"), "health_records", ["record_date"], unique=False
    )

    op.create_table(
        "breeding_cycles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("hog_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ongoing"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["hog_id"], ["hogs.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_breeding_cycles_hog_id"), "breeding_cycles", ["hog_id"], unique=False)

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("hog_id", sa.Integer(), nullable=False),
        sa.Column("alert_rule_id", sa.Integer(), nullable=True),
        sa.Column("alert_type", sa.String(length=64), nullable=False),
        sa.Column("alert_date", sa.Date(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["alert_rule_id"], ["alert_rules.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["hog_id"], ["hogs.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alerts_alert_type"), "alerts", ["alert_type"], unique=False)
    op.create_index(op.f("ix_alerts_hog_id"), "alerts", ["hog_id"], unique=False)
    op.create_index(op.f("ix_alerts_alert_date"), "alerts", ["alert_date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_alerts_alert_date"), table_name="alerts")
    op.drop_index(op.f("ix_alerts_hog_id"), table_name="alerts")
    op.drop_index(op.f("ix_alerts_alert_type"), table_name="alerts")
    op.drop_table("alerts")

    op.drop_index(op.f("ix_breeding_cycles_hog_id"), table_name="breeding_cycles")
    op.drop_table("breeding_cycles")

    op.drop_index(op.f("ix_health_records_record_date"), table_name="health_records")
    op.drop_index(op.f("ix_health_records_hog_id"), table_name="health_records")
    op.drop_table("health_records")

    op.drop_index(op.f("ix_feed_records_record_date"), table_name="feed_records")
    op.drop_index(op.f("ix_feed_records_hog_id"), table_name="feed_records")
    op.drop_table("feed_records")

    op.drop_index(op.f("ix_alert_rules_farm_id"), table_name="alert_rules")
    op.drop_table("alert_rules")

    op.drop_constraint("fk_hogs_updated_by_user_id", "hogs", type_="foreignkey")
    op.drop_column("hogs", "updated_by_user_id")

    op.drop_index("uq_hogs_farm_tag_active", table_name="hogs")
    op.create_unique_constraint("uq_hog_farm_tag", "hogs", ["farm_id", "tag_number"])
