import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_endpoint(client: AsyncClient):
    response = await client.get("/api/v1/search?q=hostel&page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data


@pytest.mark.asyncio
async def test_search_with_filters(client: AsyncClient):
    response = await client.get("/api/v1/search?campus_slug=dekut&min_price=1000&max_price=20000")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
