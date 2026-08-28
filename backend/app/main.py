from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import settings
from app.core.logging import logger, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
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
