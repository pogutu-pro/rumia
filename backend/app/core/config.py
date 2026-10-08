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
    # Needed only to create login identities (admin 'add agent'); removed with Supabase Auth.
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Own authentication (replaces Supabase Auth). Until cutover AUTH_MODE stays "supabase" and the
    # /auth endpoints refuse to run; tokens signed by us are accepted by the verifier either way.
    AUTH_MODE: str = "supabase"  # "supabase" | "custom"
    AUTH_JWT_SECRET: str = ""    # >= 32 random bytes; signs our access tokens and OAuth state
    AUTH_ACCESS_TTL_SECONDS: int = 1800
    AUTH_REFRESH_TTL_DAYS: int = 30
    AUTH_ALLOWED_APP_REDIRECTS: List[str] = ["rumia://"]  # mobile deep links allowed after login
    AUTH_COOKIE_SECURE: bool = True
    AUTH_DEV_LOGIN: bool = False  # development only: /auth/dev-login without Google
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""  # must match the URI registered in Google Cloud Console

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

    # Defaults for the first market. Nothing else in the code should name a campus, county or school.
    DEFAULT_CAMPUS_SLUG: str = "dekut"
    DEFAULT_COUNTY: str = "nyeri"
    # Email domains that mark a student of a supported institution as school-verified.
    SCHOOL_EMAIL_DOMAINS: List[str] = ["dkut.ac.ke"]

    # Who a seeker's WhatsApp/call goes to when a listing has both an agent and a separate owner number.
    # "agent_first" keeps today's behaviour (the listing's agent); "owner_first" prefers the owner's number.
    INQUIRY_CONTACT_POLICY: str = "agent_first"
    # Until the revenue model is decided, a contact on a commission-paying listing still accrues the legacy
    # per-click commission (deduplicated per verified visitor). Turn off once outcome-based money replaces it.
    INQUIRY_ACCRUES_LEGACY_COMMISSION: bool = True

    # Fee recorded when a move-in is confirmed (KES). 0 = nothing is recorded; set once the revenue model is decided.
    LEDGER_MOVE_IN_FEE_KES: float = 0

    # Scheduled jobs (delivery retries, announcement cleanup). In production the API sets this to
    # false and a single `worker` container runs them, so they never run once per web worker.
    RUN_SCHEDULER: bool = True

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
