"""Sentry initialisation shared by the API and the worker process."""

from app.core.config import settings
from app.core.logging import logger


def init_sentry() -> None:
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
