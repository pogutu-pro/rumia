from app.features.bnb.router import _to_read
from app.features.listings.schemas import ListingRead
from tests.conftest import _make_mock_listing


def test_bnb_response_maps_verified_and_agent_slug_without_losing_existing_fields():
    listing = _make_mock_listing(
        id="00000000-0000-0000-0000-000000000041",
        title="Lakeview short stay",
        property_type="short_stay",
    )
    listing.verified = True
    listing.agent.slug = "lakeview-host"

    response = _to_read(listing, None)

    assert response.verified is True
    assert response.agent == {
        "id": listing.agent.id,
        "name": listing.agent.name,
        "phone": listing.agent.phone,
        "whatsapp": listing.agent.whatsapp,
        "slug": "lakeview-host",
    }
    assert response.id == listing.id
    assert response.title == "Lakeview short stay"
    assert response.property_type == "short_stay"
    assert response.price == listing.price
    assert response.location == listing.location
    assert response.images == []
    assert response.bnb is None


def test_generic_listing_read_still_validates_with_agent_slug_field():
    listing = _make_mock_listing()
    listing.agent.slug = "existing-agent-slug"

    response = ListingRead.model_validate(listing)

    assert response.id == listing.id
    assert response.title == listing.title
    assert response.agent is not None
    assert response.agent.slug == "existing-agent-slug"
    assert response.images == []
