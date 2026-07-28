import logging
import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings

logger = logging.getLogger(__name__)


def _use_sqlite_fallback() -> bool:
    return settings.database_url.startswith("sqlite") or os.getenv("USE_SQLITE_FOR_LOCAL", "0") == "1"


def _create_sqlite_schema(engine) -> None:
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys = ON"))
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS farms (
                id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (id)
            )
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER NOT NULL,
                farm_id INTEGER NOT NULL,
                email VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                failed_login_attempts INTEGER NOT NULL DEFAULT 0,
                locked_until DATETIME,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                UNIQUE (email),
                FOREIGN KEY (farm_id) REFERENCES farms (id)
            )
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS hogs (
                id INTEGER NOT NULL,
                farm_id INTEGER NOT NULL,
                tag_number VARCHAR(64) NOT NULL,
                birth_date DATE NOT NULL,
                breed VARCHAR(128) NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'active',
                created_by_user_id INTEGER,
                updated_by_user_id INTEGER,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                UNIQUE (farm_id, tag_number),
                FOREIGN KEY (farm_id) REFERENCES farms (id),
                FOREIGN KEY (created_by_user_id) REFERENCES users (id),
                FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
            )
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS alert_rules (
                id INTEGER NOT NULL,
                farm_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                rule_type VARCHAR(64) NOT NULL,
                config_json TEXT,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                FOREIGN KEY (farm_id) REFERENCES farms (id)
            )
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS feed_records (
                id INTEGER NOT NULL,
                hog_id INTEGER NOT NULL,
                feed_amount NUMERIC(12, 4) NOT NULL,
                feed_cost NUMERIC(14, 2) NOT NULL,
                currency_code VARCHAR(3) NOT NULL DEFAULT 'NGN',
                record_date DATE NOT NULL,
                created_by_user_id INTEGER,
                updated_by_user_id INTEGER,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                FOREIGN KEY (hog_id) REFERENCES hogs (id),
                FOREIGN KEY (created_by_user_id) REFERENCES users (id),
                FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
            )
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS health_records (
                id INTEGER NOT NULL,
                hog_id INTEGER NOT NULL,
                weight NUMERIC(10, 3) NOT NULL,
                temperature NUMERIC(5, 2),
                notes TEXT,
                record_date DATE NOT NULL,
                created_by_user_id INTEGER,
                updated_by_user_id INTEGER,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                FOREIGN KEY (hog_id) REFERENCES hogs (id),
                FOREIGN KEY (created_by_user_id) REFERENCES users (id),
                FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
            )
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS breeding_cycles (
                id INTEGER NOT NULL,
                hog_id INTEGER NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE,
                status VARCHAR(32) NOT NULL DEFAULT 'ongoing',
                notes TEXT,
                created_by_user_id INTEGER,
                updated_by_user_id INTEGER,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                FOREIGN KEY (hog_id) REFERENCES hogs (id),
                FOREIGN KEY (created_by_user_id) REFERENCES users (id),
                FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
            )
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER NOT NULL,
                hog_id INTEGER NOT NULL,
                alert_rule_id INTEGER,
                alert_type VARCHAR(64) NOT NULL,
                alert_date DATE NOT NULL,
                message TEXT NOT NULL,
                status VARCHAR(32) NOT NULL DEFAULT 'open',
                resolution_notes TEXT,
                created_by_user_id INTEGER,
                updated_by_user_id INTEGER,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                FOREIGN KEY (hog_id) REFERENCES hogs (id),
                FOREIGN KEY (alert_rule_id) REFERENCES alert_rules (id),
                FOREIGN KEY (created_by_user_id) REFERENCES users (id),
                FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
            )
            """
        )
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_users_farm_id ON users (farm_id)")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_hogs_farm_id ON hogs (farm_id)")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_feed_records_hog_id ON feed_records (hog_id)")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_health_records_hog_id ON health_records (hog_id)")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_alerts_hog_id ON alerts (hog_id)")


def run_migrations() -> None:
    backend_dir = Path(__file__).resolve().parent.parent.parent

    if _use_sqlite_fallback():
        sqlite_path = backend_dir / "app" / "local_dev.db"
        engine = create_engine(
            f"sqlite:///{sqlite_path}",
            connect_args={"check_same_thread": False},
        )
        _create_sqlite_schema(engine)
        try:
            from app.seed_demo import seed_demo_data

            seeded = seed_demo_data()
            logger.info("Seeded local demo data: %s", seeded)
        except Exception as exc:  # pragma: no cover - defensive fallback for local development
            logger.warning("Demo data seeding failed: %s", exc)
        logger.info("Initialized local SQLite database at %s", sqlite_path)
        return

    ini_path = backend_dir / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))

    try:
        command.upgrade(cfg, "head")
        return
    except OperationalError as exc:
        logger.warning("Database unavailable for migrations, trying fallback startup initialization: %s", exc)
    except Exception as exc:  # pragma: no cover - defensive fallback for local development
        logger.warning("Migrations failed, trying fallback startup initialization: %s", exc)

    try:
        engine = create_engine(settings.database_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection established")
    except Exception as exc:  # pragma: no cover - defensive fallback for local development
        logger.warning("Fallback database initialization failed: %s", exc)
