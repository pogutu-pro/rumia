import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_campuses(client: AsyncClient):
    response = await client.get("/api/v1/campuses")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_campus_not_found(client: AsyncClient):
    response = await client.get("/api/v1/campuses/non-existent-campus-slug-999")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["code"] == "NOT_FOUND"
