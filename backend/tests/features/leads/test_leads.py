from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_track_lead_public(client: AsyncClient):
    from datetime import datetime, timezone
    from app.features.leads.models import Lead
    mock_lead = Lead(
        id="lead-123",
        listing_id="test-listing-1",
        agent_id="agent-1",
        ip_hash="abc123hash",
        source="whatsapp",
        clicked_at=datetime.now(timezone.utc),
    )
    with patch("app.features.leads.service.LeadService.track_lead", new_callable=AsyncMock, return_value=mock_lead):
        payload = {
            "listing_id": "test-listing-1",
            "ip_hash": "abc123hash",
            "source": "whatsapp",
        }
        response = await client.post("/api/v1/leads/track", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["listing_id"] == "test-listing-1"


@pytest.mark.asyncio
async def test_list_leads_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/leads")
    assert response.status_code == 401
