"""Settings loaded from environment / .env."""
from __future__ import annotations

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

    # Environment
    env: str = Field(default="dev", description="dev | prod")

    # API keys
    gemini_api_key: str = Field(..., description="Google Gemini API key")
    finnhub_api_key: str = Field(..., description="Finnhub free-tier API key")

    # Supabase
    supabase_url: str
    supabase_key: str  # service role key for server-side ops

    # CORS
    cors_origins: list[str] = Field(default=["http://localhost:5173"])

    # LLM
    gemini_model: str = Field(default="gemini-2.0-flash")
    gemini_max_output_tokens: int = Field(default=2048)
    narrative_cache_hours: int = Field(default=24)
    # Nominal cap (not enforced in code — cache 24h is the primary protection)
    gemini_daily_cap_requests: int = Field(default=50)

    # Market data
    price_cache_minutes_market_open: int = Field(default=60)
    price_cache_hours_market_closed: int = Field(default=24)

    # Email alerts
    alert_email_sender: str = Field(default="")
    alert_email_password: str = Field(default="")
    alert_check_time: str = Field(default="18:30")

    # Web Push (VAPID)
    vapid_public_key: str = Field(default="")
    vapid_private_key: str = Field(default="")  # base64-encoded PEM
    vapid_subject: str = Field(default="mailto:admin@example.com")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
