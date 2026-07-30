"""Test fixtures.

The suite runs against a `hogfarm_test` database on the same Postgres container
that normal development already uses. Not testcontainers: that starts a
container per run and needs Docker reachable from the Stop-hook on every turn,
and this repo has already hit an environment where the registry was unreachable.

If Postgres is not running the suite **skips** rather than fails. A stopped
container should not block every backend commit. The trade-off is that a
forgotten `make db-up` silently reduces coverage, so the skip reason says so.
"""

from collections.abc import Callable, Generator
from contextlib import AbstractContextManager, nullcontext
from typing import Any

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.core.config import settings

TEST_DB_NAME = "hogfarm_test"


def _test_database_url() -> str:
    base, _, _ = settings.database_url.rpartition("/")
    return f"{base}/{TEST_DB_NAME}"


def _admin_url() -> str:
    base, _, _ = settings.database_url.rpartition("/")
    return f"{base}/postgres"


@pytest.fixture(scope="session")
def engine() -> Generator[Engine, None, None]:
    try:
        admin = create_engine(_admin_url(), isolation_level="AUTOCOMMIT")
        with admin.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_DB_NAME}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
        admin.dispose()
    except OperationalError as exc:
        pytest.skip(
            f"PostgreSQL unreachable ({exc.__class__.__name__}) — start it with `make db-up`. "
            "Database-backed tests were skipped.",
            allow_module_level=True,
        )

    url = _test_database_url()
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")

    eng = create_engine(url)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine: Engine) -> Generator[Session, None, None]:
    """A session wrapped in a transaction that is always rolled back.

    Cheaper and more reliable than truncating between tests, and it means tests
    cannot leak state into one another regardless of execution order.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    from app.api.v1.endpoints.exports import get_session_ctx
    from app.db.session import get_db
    from app.main import app

    def _override() -> Generator[Session, None, None]:
        yield db

    # Streaming exports open their own session by design; point that at the
    # test transaction too, with a context manager that does not close it.
    def _session_ctx() -> Callable[[], AbstractContextManager[Session]]:
        return lambda: nullcontext(db)

    app.dependency_overrides[get_db] = _override
    app.dependency_overrides[get_session_ctx] = _session_ctx
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def registered(client: TestClient) -> dict[str, Any]:
    """A registered manager plus an auth header, on a farm of their own."""
    payload = {
        "email": "tester@example.com",
        "password": "Testpass123",
        "full_name": "Test Manager",
        "farm_name": "Test Farm",
    }
    client.post("/api/v1/auth/register", json=payload)
    token = client.post(
        "/api/v1/auth/login",
        data={"username": payload["email"], "password": payload["password"]},
    ).json()["access_token"]
    return {"headers": {"Authorization": f"Bearer {token}"}, **payload}
