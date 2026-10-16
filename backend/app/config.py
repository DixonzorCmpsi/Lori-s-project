"""Application configuration using pydantic-settings."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database (Supabase PostgreSQL — set via DATABASE_URL in .env)
    database_url: str = Field(
        default="postgresql://callboard:callboard_dev@localhost:5432/callboard",
    )

    # Auth
    nextauth_secret: str = Field(default="dev-secret-min-32-chars-abcdefghijklmnop")
    nextauth_url: str = Field(default="http://localhost:3000")

    # Google OAuth
    google_client_id: str | None = None
    google_client_secret: str | None = None

    # Email (Resend)
    resend_api_key: str | None = None
    email_from: str = "noreply@callboard.deetalk.win"

    # Supabase (production)
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None

    # Storage provider: "supabase" or "local"
    storage_provider: str = "local"

    # Realtime provider: "supabase" or "ws"
    realtime_provider: str = "ws"

    # App
    app_name: str = "Digital Call Board"
    debug: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
