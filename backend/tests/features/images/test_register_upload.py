import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app

USER = "8f853c92-36bf-455d-b21f-14471ec16311"


def _payload(base: str) -> dict:
    return {
        "original_filename": "room.jpg", "width": 1200, "height": 800, "file_size": 54321,
        "format": "image/webp",
        "thumbnail_key": f"{base}/thumb.webp", "small_key": f"{base}/card.webp",
        "medium_key": f"{base}/gallery.webp", "large_key": f"{base}/large.webp",
    }


def _as(user_id: str, role: str = "agent"):
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=user_id, email="a@rumia.app", role=role)


@pytest.mark.asyncio
async def test_register_requires_login(client: AsyncClient):
    assert (await client.post("/api/v1/images/uploads", json=_payload(f"{USER}/room_abc"))).status_code == 401


@pytest.mark.asyncio
async def test_register_accepts_keys_under_own_prefix(client: AsyncClient):
    _as(USER)
    try:
        response = await client.post("/api/v1/images/uploads", json=_payload(f"{USER}/room_abc123"))
        assert response.status_code == 201
        assert response.json()["thumbnail_key"] == f"{USER}/room_abc123/thumb.webp"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
@pytest.mark.parametrize("base", [
    "someone-else/room_abc",            # another user's prefix
    f"{USER}/../victim/room_abc",       # traversal
    f"{USER}",                          # no object folder
    f"{USER}/a/b",                      # too deep
])
async def test_register_rejects_foreign_or_malformed_prefix(client: AsyncClient, base: str):
    _as(USER)
    try:
        response = await client.post("/api/v1/images/uploads", json=_payload(base))
        assert response.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_register_rejects_mismatched_variant_names(client: AsyncClient):
    _as(USER)
    try:
        body = _payload(f"{USER}/room_abc")
        body["large_key"] = f"{USER}/room_abc/original.webp"
        assert (await client.post("/api/v1/images/uploads", json=body)).status_code == 400
        body = _payload(f"{USER}/room_abc")
        body["small_key"] = f"{USER}/other_folder/card.webp"
        assert (await client.post("/api/v1/images/uploads", json=body)).status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)
