from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api import api_router
from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.core.ratelimit import limiter, rate_limit_exceeded_handler


def _init_sentry() -> None:
    """Initialize Sentry SDK for error tracking and performance monitoring."""
    if not settings.SENTRY_DSN:
        return
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    import logging

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release=settings.VERSION,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
            LoggingIntegration(
                level=logging.WARNING,      # Capture warnings+ as breadcrumbs
                event_level=logging.ERROR,  # Send errors+ as Sentry events
            ),
        ],
        send_default_pii=False,  # Never send personally identifiable information
    )
    logger.info("Sentry SDK initialized", environment=settings.ENVIRONMENT)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    _init_sentry()
    logger.info(
        "Starting Rumia FastAPI Backend",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )
    # Start background maintenance cron jobs
    from app.core.tasks.cron import start_cron_jobs
    start_cron_jobs()
    yield
    logger.info("Shutting down Rumia FastAPI Backend")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# App-level rate limiting (slowapi). The exception handler is registered up
# front so the middleware stack (cached after the first request) always knows
# how to render a 429; enforcement is gated by `limiter.enabled`.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Include API v1 routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", include_in_schema=False)
def root():
    return JSONResponse(
        {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "documentation": "/docs",
            "health": f"{settings.API_V1_STR}/health",
        }
    )
