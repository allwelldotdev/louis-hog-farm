"""Per-farm data-version counter maintained by statement-level triggers.

The dashboard caches metrics in the browser and needs to know when the database
has moved on. `GET /meta/data-version` reads one row by primary key (~0.1 ms) and
the client invalidates its cached queries when the number changes.

Two deliberate choices:

* **Triggers, not a SQLAlchemy event hook.** Triggers catch every writer — the
  API, the seeder, and someone editing a row directly in psql. An ORM-level hook
  sees only traffic that goes through the ORM, so a manual SQL edit would leave
  the dashboard showing stale numbers with no way to notice.
* **FOR EACH STATEMENT with transition tables, not FOR EACH ROW.** The bulk
  seeder inserts tens of thousands of rows in a handful of statements. A
  row-level trigger would fire once per row; this fires once per statement.

Depends on m2_003: the trigger reads farm_id straight off the changed rows, which
is only possible because farm_id is denormalized onto the child tables.

Revision ID: m4_005
Revises: m3_004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "m4_005"
down_revision: str | None = "m3_004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

VERSIONED_TABLES = [
    "hogs",
    "feed_records",
    "health_records",
    "breeding_cycles",
    "alerts",
    "vaccinations",
    "mortality_events",
]


def upgrade() -> None:
    op.create_table(
        "data_versions",
        sa.Column(
            "farm_id",
            sa.Integer(),
            sa.ForeignKey("farms.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("version", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )

    # Every existing farm starts at version 0 so the endpoint never 404s.
    op.execute("INSERT INTO data_versions (farm_id, version) SELECT id, 0 FROM farms")

    # A new farm needs its counter row to exist from the moment it is created.
    op.execute(
        """
        CREATE FUNCTION hogfarm_seed_data_version() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            INSERT INTO data_versions (farm_id, version)
            SELECT id, 0 FROM new_farms
            ON CONFLICT (farm_id) DO NOTHING;
            RETURN NULL;
        END $$;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_farms_seed_version
        AFTER INSERT ON farms
        REFERENCING NEW TABLE AS new_farms
        FOR EACH STATEMENT EXECUTE FUNCTION hogfarm_seed_data_version();
        """
    )

    # Two functions because the rows to read live in NEW for insert/update and in
    # OLD for delete. An update that moved a row between farms is covered by the
    # pair firing on both.
    op.execute(
        """
        CREATE FUNCTION hogfarm_bump_version_new() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            INSERT INTO data_versions (farm_id, version, updated_at)
            SELECT DISTINCT farm_id, 1, now() FROM changed_rows
            ON CONFLICT (farm_id)
            DO UPDATE SET version = data_versions.version + 1, updated_at = now();
            RETURN NULL;
        END $$;
        """
    )
    op.execute(
        """
        CREATE FUNCTION hogfarm_bump_version_old() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            INSERT INTO data_versions (farm_id, version, updated_at)
            SELECT DISTINCT farm_id, 1, now() FROM changed_rows
            ON CONFLICT (farm_id)
            DO UPDATE SET version = data_versions.version + 1, updated_at = now();
            RETURN NULL;
        END $$;
        """
    )

    for table in VERSIONED_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_version_ins
            AFTER INSERT ON {table}
            REFERENCING NEW TABLE AS changed_rows
            FOR EACH STATEMENT EXECUTE FUNCTION hogfarm_bump_version_new();
            """
        )
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_version_upd
            AFTER UPDATE ON {table}
            REFERENCING NEW TABLE AS changed_rows
            FOR EACH STATEMENT EXECUTE FUNCTION hogfarm_bump_version_new();
            """
        )
        op.execute(
            f"""
            CREATE TRIGGER trg_{table}_version_del
            AFTER DELETE ON {table}
            REFERENCING OLD TABLE AS changed_rows
            FOR EACH STATEMENT EXECUTE FUNCTION hogfarm_bump_version_old();
            """
        )


def downgrade() -> None:
    for table in VERSIONED_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_version_del ON {table}")
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_version_upd ON {table}")
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_version_ins ON {table}")
    op.execute("DROP TRIGGER IF EXISTS trg_farms_seed_version ON farms")
    op.execute("DROP FUNCTION IF EXISTS hogfarm_bump_version_old()")
    op.execute("DROP FUNCTION IF EXISTS hogfarm_bump_version_new()")
    op.execute("DROP FUNCTION IF EXISTS hogfarm_seed_data_version()")
    op.drop_table("data_versions")
