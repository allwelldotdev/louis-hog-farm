from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolved from __file__ rather than the CWD. The previous relative env_file and
# relative SQLite path meant that starting the server from anywhere other than
# backend/ silently read a different file than the one migrations wrote to.
_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # database_url and jwt_secret intentionally have no defaults. The old
    # fallbacks ("change-me", a local SQLite path) let a misconfigured process
    # boot and report healthy; a missing value must stop startup instead.
    database_url: str
    jwt_secret: str = Field(min_length=32)

    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 7

    app_env: Literal["dev", "test", "prod"] = "dev"

    # Comma-separated rather than a JSON list: pydantic-settings parses list[str]
    # from JSON, which is an awkward thing to write in a .env file.
    cors_origins: str = "http://localhost:3000"

    # Keep pool_size at or above the uvicorn worker count.
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle: int = 1800

    @field_validator("database_url")
    @classmethod
    def _require_postgres(cls, value: str) -> str:
        if not value.startswith("postgresql"):
            raise ValueError(
                "DATABASE_URL must be a PostgreSQL URL "
                "(e.g. postgresql+psycopg2://user:pass@host:5432/db). "
                "SQLite support was removed."
            )
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
