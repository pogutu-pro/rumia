import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_liveness_endpoint(client: AsyncClient):
    """Test fast liveness probe endpoint."""
    response = await client.get("/api/v1/health/liveness")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ok"}


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """Test full system health check endpoint."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "version" in data
    assert "environment" in data
    assert "services" in data
    assert "database" in data["services"]


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    """Test API root metadata endpoint."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["documentation"] == "/docs"
    assert data["health"] == "/api/v1/health"
