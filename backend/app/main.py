from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api import api_router
from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.core.ratelimit import limiter, rate_limit_exceeded_handler
from app.core.sentry import init_sentry


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    init_sentry()
    logger.info(
        "Starting Rumia FastAPI Backend",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )
    # Scheduled jobs run in the dedicated worker process (python -m app.worker). They stay enabled
    # here only when RUN_SCHEDULER is on (local development without a separate worker).
    if settings.RUN_SCHEDULER:
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
