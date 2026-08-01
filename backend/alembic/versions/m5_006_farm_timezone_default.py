"""Default a new farm's timezone to Africa/Lagos rather than UTC.

The system is built for Nigerian pig farms first, and `backend/app/seed/` has
always created its farms with `Africa/Lagos`. Only `/auth/register` fell back to
UTC, so a farm created through the app disagreed with a farm created by the
seeder about what "today" meant — and `farm_today()` is what decides whether a
same-day record entered after 23:00 local is rejected as being in the future.

Deliberately no backfill. Existing rows keep whatever they were set to: a farm
genuinely operating on UTC should stay there, and rewriting the column would
shift the date boundaries under records that have already been entered against
the old zone.

Revision ID: m5_006
Revises: m4_005
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "m5_006"
down_revision: str | None = "m4_005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "farms",
        "timezone",
        existing_type=sa.String(length=64),
        existing_nullable=False,
        server_default="Africa/Lagos",
    )


def downgrade() -> None:
    op.alter_column(
        "farms",
        "timezone",
        existing_type=sa.String(length=64),
        existing_nullable=False,
        server_default="UTC",
    )
