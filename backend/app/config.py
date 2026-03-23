"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = Field(
        default="postgresql://callboard:callboard_dev@localhost:5432/callboard",
    )

    # Auth
    nextauth_secret: str = Field(default="dev-secret-min-32-chars-abcdefghijklmnop")
    nextauth_url: str = Field(default="http://localhost:3000")

    # Google OAuth
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None

    # Email/SMTP
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    email_from: str = "noreply@digitalcallboard.com"

    # Supabase (production)
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None

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
