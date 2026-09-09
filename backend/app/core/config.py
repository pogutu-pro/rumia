import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Rumia Backend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"

    # Supabase Auth
    SUPABASE_URL: str = ""
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_ANON_KEY: str = ""

    # CORS Configuration
    # Web app (Next.js on :3000), mobile (Expo web dev on :8081 / legacy :19006),
    # and the public rumia.co.ke domain.
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "https://rumia.co.ke",
        "https://www.rumia.co.ke",
    ]

    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "rumia-uploads"
    R2_PUBLIC_URL: str = "https://pub-35395ff8fc144313adfa903807f2a359.r2.dev"

    # Web Push (VAPID)
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:contact@rumia.co.ke"

    # Rate limiting (per-IP, app-level). Sensitive routes apply stricter limits.
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "300/minute"

    # Expo Push (optional bearer token when EAS push security is enabled)
    EXPO_PUSH_ACCESS_TOKEN: str = ""

    # Brevo Transactional Email
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "contact@rumia.co.ke"
    BREVO_SENDER_NAME: str = "Rumia"
    BREVO_WEBHOOK_SECRET: str = ""

    # Public site base URL (used for building deep links in emails/push)
    PUBLIC_BASE_URL: str = "https://rumia.co.ke"

    # PostHog Telemetry
    POSTHOG_PROJECT_TOKEN: str = ""
    POSTHOG_HOST: str = "https://eu.i.posthog.com"

    # Sentry Error Tracking
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.2  # 20% of transactions for performance tracking
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.1  # 10% of transactions for profiling

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        # Allow reading NEXT_PUBLIC_SUPABASE_URL → SUPABASE_URL via env aliases
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if not v:
            return "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
        # Ensure asyncpg driver prefix for SQLAlchemy 2.0 async
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, str):
            return v.lower() not in ("false", "0", "no", "release", "")
        return v


settings = Settings()
