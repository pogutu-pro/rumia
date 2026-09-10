"""Fire-and-forget telemetry for backend events and errors.

Centralizes the sinks used during profile creation (and elsewhere) so service
code stays clean and telemetry failures can never break a request:

  - structlog -> JSON structured logs (always)
  - Sentry    -> capture_exception when SENTRY_DSN is configured
  - PostHog   -> capture() when POSTHOG_PROJECT_TOKEN is configured

The equalized event name for the profile-completion funnel is
`profile_completion_failed` (frontend + backend so dashboards correlate) and
`profile_completion_succeeded` for completions.
"""

from __future__ import annotations

import os
import threading
from typing import Any, Mapping, Optional

import structlog

from app.core.config import settings

logger = structlog.get_logger()

_posthog_ready = False
_ready_lock = threading.Lock()


def _under_test() -> bool:
    """Keep telemetry inert under pytest so test runs never emit real events."""
    return "PYTEST_CURRENT_TEST" in os.environ


def _ensure_posthog() -> bool:
    """Lazily configure the PostHog client once. Never raises."""
    global _posthog_ready
    if _posthog_ready:
        return True
    if not settings.POSTHOG_PROJECT_TOKEN:
        return False
    try:
        import posthog

        posthog.project_api_key = settings.POSTHOG_PROJECT_TOKEN
        posthog.host = settings.POSTHOG_HOST
        with _ready_lock:
            _posthog_ready = True
        return True
    except Exception:
        return False


def _send_sentry(
    error: BaseException,
    event_name: str,
    user_id: Optional[str],
    extra: Optional[Mapping[str, Any]],
) -> None:
    try:
        import sentry_sdk
        from sentry_sdk import capture_exception, push_scope

        with push_scope() as scope:
            scope.set_tag("event_name", event_name)
            if user_id:
                scope.set_user({"id": user_id})
            if extra:
                scope.set_context("rumia_error", dict(extra))
            capture_exception(error)
    except Exception:
        pass


def capture_error(
    event_name: str,
    error: BaseException,
    user_id: Optional[str] = None,
    extra: Optional[Mapping[str, Any]] = None,
) -> None:
    """Log, send to Sentry and PostHog, never raising on telemetry failure."""
    exc_class = type(error).__name__
    logger.error(
        event_name,
        error=exc_class,
        detail=str(error)[:500],
        user_id=user_id,
        **(extra or {}),
    )
    if _under_test():
        return
    _send_sentry(error, event_name, user_id, extra)
    if _ensure_posthog():
        try:
            import posthog

            posthog.capture(
                distinct_id=user_id or "anonymous",
                event=event_name,
                properties={
                    "source": "backend",
                    "error_class": exc_class,
                    "detail": str(error)[:500],
                    **(extra or {}),
                },
            )
        except Exception:
            pass


def capture_event(
    event_name: str,
    distinct_id: Optional[str] = None,
    properties: Optional[Mapping[str, Any]] = None,
) -> None:
    """Send a non-error analytics event to PostHog if configured."""
    if _under_test() or not _ensure_posthog():
        return
    try:
        import posthog

        posthog.capture(
            distinct_id=distinct_id or "anonymous",
            event=event_name,
            properties={"source": "backend", **(properties or {})},
        )
    except Exception:
        pass