from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.features.hostel_requests.models import HostelRequest
from app.features.hostel_requests.service import clean_kenyan_phone
from app.core.errors import BadRequestException


def _make_request(**kwargs) -> HostelRequest:
    now = datetime.now(timezone.utc)
    return HostelRequest(
        id=kwargs.get("id", "request-1"),
        user_id=kwargs.get("user_id", "user-1"),
        student_name=kwargs.get("student_name", "Jane Student"),
        phone=kwargs.get("phone", "+254712345678"),
        campus_id=kwargs.get("campus_id", "campus-1"),
        preferred_zone=kwargs.get("preferred_zone", "Gate A"),
        budget_range=kwargs.get("budget_range", "5000_7000"),
        gender=kwargs.get("gender", "female"),
        room_type=kwargs.get("room_type", "single"),
        furnishing=kwargs.get("furnishing", "no_preference"),
        stay_preference=kwargs.get("stay_preference", "alone"),
        move_in_date=kwargs.get("move_in_date", None),
        additional_requirements=kwargs.get("additional_requirements", None),
        status=kwargs.get("status", "waiting"),
        fee=kwargs.get("fee", 100),
        created_at=kwargs.get("created_at", now),
        updated_at=kwargs.get("updated_at", now),
    )


def test_clean_kenyan_phone():
    assert clean_kenyan_phone("0712345678") == "+254712345678"
    assert clean_kenyan_phone("+254712345678") == "+254712345678"
    assert clean_kenyan_phone("0112345678") == "+254112345678"
    with pytest.raises(BadRequestException):
        clean_kenyan_phone("999")


@pytest.mark.asyncio
async def test_create_request_unauthorized(client: AsyncClient):
    payload = {
        "phone": "0712345678",
        "budget_range": "5000_7000",
        "gender": "no_preference",
    }
    response = await client.post("/api/v1/hostel-requests", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_my_requests_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/hostel-requests/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_form_config_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/hostel-requests/form-config")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_request_authed(authed_client: AsyncClient):
    created = _make_request(id="request-1", budget_range="5000_7000")
    with patch(
        "app.features.hostel_requests.service.HostelRequestService.create_request",
        new_callable=AsyncMock,
        return_value=created,
    ):
        payload = {
            "phone": "0712345678",
            "preferred_zone": "Gate A",
            "budget_range": "5000_7000",
            "gender": "female",
            "room_type": "single",
            "furnishing": "no_preference",
            "stay_preference": "alone",
        }
        response = await authed_client.post("/api/v1/hostel-requests", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == "request-1"
        assert data["status"] == "waiting"
        assert data["fee"] == 100


@pytest.mark.asyncio
async def test_list_my_requests_authed(authed_client: AsyncClient):
    item = _make_request(id="request-2")
    with patch(
        "app.features.hostel_requests.service.HostelRequestService.list_my_requests",
        new_callable=AsyncMock,
        return_value=[item],
    ):
        response = await authed_client.get("/api/v1/hostel-requests/me")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "request-2"


@pytest.mark.asyncio
async def test_update_request_authed(authed_client: AsyncClient):
    updated = _make_request(id="request-1", room_type="bedsitter")
    with patch(
        "app.features.hostel_requests.service.HostelRequestService.update_request",
        new_callable=AsyncMock,
        return_value=updated,
    ):
        response = await authed_client.patch(
            "/api/v1/hostel-requests/request-1",
            json={"room_type": "bedsitter"},
        )
        assert response.status_code == 200
        assert response.json()["room_type"] == "bedsitter"


@pytest.mark.asyncio
async def test_cancel_request_authed(authed_client: AsyncClient):
    cancelled = _make_request(id="request-1", status="cancelled")
    with patch(
        "app.features.hostel_requests.service.HostelRequestService.cancel_request",
        new_callable=AsyncMock,
        return_value=cancelled,
    ):
        response = await authed_client.post("/api/v1/hostel-requests/request-1/cancel")
        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_delete_request_authed(authed_client: AsyncClient):
    with patch(
        "app.features.hostel_requests.service.HostelRequestService.delete_request",
        new_callable=AsyncMock,
    ):
        response = await authed_client.delete("/api/v1/hostel-requests/request-1")
        assert response.status_code == 200
        assert response.json()["message"] == "Request deleted"