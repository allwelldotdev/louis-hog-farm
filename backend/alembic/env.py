import sys
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.db.base import Base
from app.models import (  # noqa: F401
    Alert,
    AlertRule,
    BreedingCycle,
    Farm,
    FeedRecord,
    HealthRecord,
    Hog,
    User,
)

config = context.config

target_metadata = Base.metadata


def get_url() -> str:
    """Explicit `sqlalchemy.url` wins; otherwise fall back to app settings.

    Without the override the test fixture could not point Alembic at the
    hogfarm_test database — env.py unconditionally replaced the URL and migrated
    the development database instead.
    """
    configured = config.get_main_option("sqlalchemy.url", None)
    return configured or settings.database_url


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Without these, autogenerate silently misses column type and
            # server_default drift — which is how four conflicting currency
            # defaults accumulated unnoticed.
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
