import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./app/local_dev.db"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 7


settings = Settings()
if os.getenv("USE_SQLITE_FOR_LOCAL", "0") == "1":
    settings.database_url = "sqlite:///./app/local_dev.db"
