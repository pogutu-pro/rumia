import pytest
from fastapi import APIRouter, Request
from httpx import AsyncClient
from slowapi.errors import RateLimitExceeded

from app.core.ratelimit import limiter, rate_limit_exceeded_handler
from app.main import app

# Test router for rate limit tests
rl_test_router = APIRouter(prefix="/api/v1/test-ratelimit", tags=["Test RateLimit"])


@rl_test_router.get("/ping")
@limiter.limit("2/minute")
async def ping(request: Request):
    return {"status": "ok"}


app.include_router(rl_test_router)


class TestRateLimitEnvelope:
    """429 responses use the standard {error:{code,message}} envelope."""

    async def test_handler_shape(self):
        from app.core.ratelimit import rate_limit_exceeded_handler

        class _Inner:
            def get_expiry(self) -> int:
                return 60

        class _FakeLimit:
            limit = _Inner()

        exc = RateLimitExceeded.__new__(RateLimitExceeded)
        exc.limit = _FakeLimit()
        response = rate_limit_exceeded_handler(Request(scope={"type": "http", "path": "/", "headers": []}), exc)
        body = response.body.decode()
        assert '"code"' in body and '"RATE_LIMITED"' in body
        assert '"message"' in body
        assert response.headers["Retry-After"] == "60"


@pytest.fixture(autouse=True)
def enable_rate_limiting():
    app.state.limiter = limiter
    limiter.reset()
    limiter.enabled = True
    yield
    limiter.enabled = False
    limiter.reset()


@pytest.mark.asyncio
async def test_rate_limit_triggers_429_envelope(client: AsyncClient):
    # Two allowed hits then a third is rejected with the standard envelope
    for _ in range(2):
        response = await client.get(
            "/api/v1/test-ratelimit/ping",
            headers={"X-Forwarded-For": "198.51.100.10"},
        )
        assert response.status_code == 200

    response = await client.get(
        "/api/v1/test-ratelimit/ping",
        headers={"X-Forwarded-For": "198.51.100.10"},
    )
    assert response.status_code == 429, f"expected 429, got {response.status_code}"
    body = response.json()
    assert "error" in body, f"unexpected body: {body}"
    assert "message" in body["error"]


@pytest.mark.asyncio
async def test_rate_limit_keyed_by_forwarded_ip(client: AsyncClient):
    # Bursting from one IP must not exhaust another IP's quota
    for _ in range(5):
        await client.get(
            "/api/v1/test-ratelimit/ping",
            headers={"X-Forwarded-For": "203.0.113.7"},
        )

    for _ in range(2):
        response = await client.get(
            "/api/v1/test-ratelimit/ping",
            headers={"X-Forwarded-For": "203.0.113.8"},
        )
        assert response.status_code == 200

    response = await client.get(
        "/api/v1/test-ratelimit/ping",
        headers={"X-Forwarded-For": "203.0.113.8"},
    )
    assert response.status_code == 429