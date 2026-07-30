"""Readiness check: is the database reachable, and is its schema current?

Split out from liveness on purpose. The old single `/health` returned 200 while
the application had no tables at all, because startup swallowed every migration
failure and logged a warning (audit e). A green health check on a dead app is
the worst available failure mode, so there are now two probes with two distinct
claims:

* ``/health``       — the process is running. Touches nothing, cannot lie.
* ``/health/ready`` — the database answers and is migrated to the expected head.
"""

from dataclasses import dataclass
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

from app.db.session import engine

_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


@dataclass(frozen=True)
class Readiness:
    ready: bool
    detail: str
    current_revision: str | None = None
    expected_revision: str | None = None


def expected_head() -> str | None:
    """The migration revision this codebase expects the database to be at."""
    script = ScriptDirectory.from_config(Config(str(_ALEMBIC_INI)))
    return script.get_current_head()


def check() -> Readiness:
    expected = expected_head()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            current = conn.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            ).scalar_one_or_none()
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller as 503 detail
        return Readiness(
            ready=False,
            detail=f"database unreachable: {type(exc).__name__}: {exc}",
            expected_revision=expected,
        )

    if current is None:
        return Readiness(
            ready=False,
            detail="database has no alembic_version row — run `make migrate`",
            expected_revision=expected,
        )
    if current != expected:
        return Readiness(
            ready=False,
            detail=f"schema at {current}, expected {expected} — run `make migrate`",
            current_revision=current,
            expected_revision=expected,
        )
    return Readiness(
        ready=True,
        detail="ok",
        current_revision=current,
        expected_revision=expected,
    )
