from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://user:pass@localhost:5432/sahyogride"
    jwt_secret: str = "change-me"
    hold_ttl_minutes: int = 5

    ai_enabled: bool = True
    ai_api_key: str = ""
    ai_timeout_seconds: int = 5
    semantic_threshold: float = 0.5


settings = Settings()
