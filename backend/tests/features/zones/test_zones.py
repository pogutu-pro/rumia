import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_zones(client: AsyncClient):
    response = await client.get("/api/v1/zones")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_list_zones_by_campus_slug(client: AsyncClient):
    response = await client.get("/api/v1/zones?campus_slug=dekut")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
