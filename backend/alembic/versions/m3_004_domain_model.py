"""Sex, production class, lineage, mortality, vaccinations, farm currency/timezone.

The schema could not express the demonstration herd named in the project
description (1 boar, 2 sows, 3 growers, 14 piglets): there was no sex and no
production class, so every animal was an undifferentiated "hog". That also meant
a breeding cycle could be attached to a piglet or a barrow, and
AlertType.vaccination_due existed in the enum with nothing able to generate it.

Currency moves to the farm. Four conflicting defaults (GBP in the model and
migration, NGN in the SQLite DDL and the Pydantic schema) could put two
currencies in one farm, and the dashboard responds to mixed currency by nulling
out every cost KPI — so the drift silently blanked the figures. The platform is
single-currency NGN for now; the column exists so per-farm currency and FX
conversion are a later feature rather than a later migration.

Revision ID: m3_004
Revises: m2_003
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "m3_004"
down_revision: str | None = "m2_003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SEX = sa.Enum("male", "female", name="hogsex", native_enum=False, length=16)
_CLASS = sa.Enum(
    "piglet",
    "weaner",
    "grower",
    "finisher",
    "gilt",
    "sow",
    "boar",
    name="productionclass",
    native_enum=False,
    length=32,
)


def upgrade() -> None:
    op.add_column(
        "farms",
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="NGN"),
    )
    op.add_column(
        "farms",
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
    )
    # Existing rows kept GBP as a column default; align them with the platform
    # currency so historical rows and new ones agree.
    op.execute("UPDATE feed_records SET currency_code = 'NGN'")
    op.alter_column("feed_records", "currency_code", server_default="NGN")

    op.add_column("hogs", sa.Column("sex", _SEX, nullable=False, server_default="female"))
    op.add_column(
        "hogs",
        sa.Column("production_class", _CLASS, nullable=False, server_default="piglet"),
    )
    op.add_column("hogs", sa.Column("dam_id", sa.Integer(), nullable=True))
    op.add_column("hogs", sa.Column("sire_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_hogs_dam", "hogs", "hogs", ["dam_id"], ["id"])
    op.create_foreign_key("fk_hogs_sire", "hogs", "hogs", ["sire_id"], ["id"])
    op.create_index("ix_hogs_farm_class", "hogs", ["farm_id", "production_class"])

    op.create_table(
        "mortality_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hog_id", sa.Integer(), sa.ForeignKey("hogs.id"), nullable=False, unique=True),
        sa.Column("farm_id", sa.Integer(), sa.ForeignKey("farms.id"), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("cause", sa.String(128), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["hog_id", "farm_id"], ["hogs.id", "hogs.farm_id"], name="fk_mortality_events_hog_farm"
        ),
    )
    op.create_index("ix_mortality_events_farm_date", "mortality_events", ["farm_id", "event_date"])

    op.create_table(
        "vaccinations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hog_id", sa.Integer(), sa.ForeignKey("hogs.id"), nullable=False),
        sa.Column("farm_id", sa.Integer(), sa.ForeignKey("farms.id"), nullable=False),
        sa.Column("vaccine_name", sa.String(128), nullable=False),
        sa.Column("dose_date", sa.Date(), nullable=False),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["hog_id", "farm_id"], ["hogs.id", "hogs.farm_id"], name="fk_vaccinations_hog_farm"
        ),
    )
    op.create_index("ix_vaccinations_hog_date", "vaccinations", ["hog_id", "dose_date"])
    op.create_index("ix_vaccinations_farm_due", "vaccinations", ["farm_id", "next_due_date"])

    # users.email carried both a UNIQUE constraint and a separate non-unique
    # index — two b-trees for one column. Collapse to a single unique index,
    # which is what the model has always declared.
    op.drop_constraint("users_email_key", "users", type_="unique")
    op.drop_index("ix_users_email", table_name="users")
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.create_index("ix_users_email", "users", ["email"])
    op.create_unique_constraint("users_email_key", "users", ["email"])

    op.drop_index("ix_vaccinations_farm_due", table_name="vaccinations")
    op.drop_index("ix_vaccinations_hog_date", table_name="vaccinations")
    op.drop_table("vaccinations")

    op.drop_index("ix_mortality_events_farm_date", table_name="mortality_events")
    op.drop_table("mortality_events")

    op.drop_index("ix_hogs_farm_class", table_name="hogs")
    op.drop_constraint("fk_hogs_sire", "hogs", type_="foreignkey")
    op.drop_constraint("fk_hogs_dam", "hogs", type_="foreignkey")
    op.drop_column("hogs", "sire_id")
    op.drop_column("hogs", "dam_id")
    op.drop_column("hogs", "production_class")
    op.drop_column("hogs", "sex")

    op.alter_column("feed_records", "currency_code", server_default="GBP")
    op.drop_column("farms", "timezone")
    op.drop_column("farms", "currency_code")
