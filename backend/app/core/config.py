from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    app_name: str = "Seir API"
    app_version: str = "0.1.0"
    environment: Literal["development", "test", "staging", "production"] = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = "sqlite+aiosqlite:///./seir.db"
    database_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # Infrastructure
    redis_url: str | None = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 120

    # Auth
    jwt_secret_key: str = "change-me-in-production-a-long-random-secret-value"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14
    otp_ttl_seconds: int = 120
    otp_debug: bool = True
    otp_max_attempts: int = 5

    # HTTP
    # NoDecode keeps pydantic-settings from JSON-decoding the raw env value so
    # the split_csv validator below can accept plain comma-separated lists.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    allowed_hosts: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["*"])
    frontend_url: str = "http://localhost:3000"
    max_request_bytes: int = 2_000_000

    # Rate limiting
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 240
    rate_limit_window_seconds: int = 60
    auth_rate_limit_requests: int = 20

    # Data / demo
    auto_create_schema: bool = True
    seed_on_startup: bool = True
    default_currency: str = "IRT"

    # AI. The product works offline with a deterministic planner; configure one
    # of the providers below to enable conversational polishing.
    # provider: openai | openai_compatible | anthropic | gemini | none
    ai_provider: Literal["openai", "openai_compatible", "anthropic", "gemini", "none"] = "none"
    ai_api_key: str | None = None
    ai_base_url: str | None = None
    ai_model: str = "gpt-4o-mini"
    ai_timeout_seconds: float = 20.0
    ai_max_tokens: int = 450

    @field_validator("cors_origins", "allowed_hosts", mode="before")
    @classmethod
    def split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def sync_database_url(self) -> str:
        """URL used by Alembic (psycopg/asyncpg adapters removed)."""
        return (
            self.database_url.replace("+asyncpg", "+psycopg")
            .replace("+aiosqlite", "")
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
