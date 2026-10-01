import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_get_terms_public(client: AsyncClient):
    response = await client.get("/api/v1/legal/terms")
    # May return 404 if not seeded or 200 if seeded
    assert response.status_code in (200, 404)


@pytest.mark.asyncio
async def test_get_admin_legal_non_admin_forbidden(client: AsyncClient):
    user = AuthenticatedUser(id="student-1", email="student@rumia.app", role="student")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/legal/admin")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_public_legal_never_falls_back_to_an_unpublished_draft(client: AsyncClient):
    # The mock DB has no published document; the endpoint must 404 rather than serve a draft.
    response = await client.get("/api/v1/legal/terms")
    assert response.status_code == 404
