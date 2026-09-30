from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.core.security import AuthenticatedUser
from app.features.bnb.models import BnbDetails
from app.features.bnb.schemas import BnbListingUpdate
from app.features.bnb.service import BnbService
from app.features.listings.schemas import ListingUpdate
from app.features.listings.service import ListingService
from tests.conftest import MockResult, _make_mock_listing


def _existing_details() -> BnbDetails:
    return BnbDetails(
        listing_id="00000000-0000-0000-0000-000000000020",
        listing_type="entire_place",
        max_guests=4,
        bedrooms=2,
        bathrooms=1,
        bed_config=[{"type": "Double", "qty": 1}],
        price_unit="night",
        min_stay_nights=1,
        max_stay_nights=10,
        cleaning_fee=500,
        security_deposit=1000,
        extra_guest_fee=50,
        available_from=date(2027, 1, 1),
        available_until=date(2027, 2, 1),
        check_in_time="14:00",
        check_out_time="10:00",
        advance_notice_hours=12,
        house_rules={"smoking": False},
        custom_rules="Old rules",
        guest_suitability=["tourists"],
        nearby_landmark="Old landmark",
    )


async def _update_bnb(payload: dict, monkeypatch):
    listing = _make_mock_listing(
        id="00000000-0000-0000-0000-000000000020",
        property_type="short_stay",
        agent_user_id="owner-user-id",
    )
    details = _existing_details()
    user = AuthenticatedUser(id="owner-user-id", role="agent")
    db = MagicMock()
    db.execute = AsyncMock(return_value=MockResult(single=details))
    db.flush = AsyncMock()

    async def update_listing(*, data: ListingUpdate, **_kwargs):
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(listing, field, value)
        return listing

    monkeypatch.setattr(
        ListingService,
        "get_listing_by_id_or_slug",
        AsyncMock(return_value=listing),
    )
    update_listing_mock = AsyncMock(side_effect=update_listing)
    monkeypatch.setattr(ListingService, "update_listing", update_listing_mock)

    await BnbService.update_bnb_listing(
        db=db,
        listing_id=listing.id,
        user=user,
        data=BnbListingUpdate(**payload),
    )
    reloaded_listing, reloaded_details = await BnbService.get_bnb_listing(
        db=db,
        listing_id=listing.id,
    )
    return reloaded_listing, reloaded_details, update_listing_mock


@pytest.mark.asyncio
async def test_nested_bnb_update_persists_all_detail_fields(monkeypatch):
    payload = {
        "bnb": {
            "listing_type": "private_room",
            "max_guests": 6,
            "bedrooms": 3,
            "bathrooms": 2,
            "bed_config": [{"type": "Queen", "qty": 2}],
            "price_unit": "week",
            "min_stay_nights": 2,
            "max_stay_nights": 14,
            "cleaning_fee": 700,
            "security_deposit": 1200,
            "extra_guest_fee": 150,
            "available_from": "2027-03-01",
            "available_until": "2027-04-01",
            "check_in_time": "15:00",
            "check_out_time": "11:00",
            "advance_notice_hours": 24,
            "house_rules": {
                "smoking": True,
                "pets": False,
                "parties": False,
                "visitors": True,
                "children": True,
                "quiet_hours": "22:00-07:00",
            },
            "custom_rules": "Updated rules",
            "guest_suitability": ["families", "groups"],
            "nearby_landmark": "Updated landmark",
        }
    }

    _, reloaded, _ = await _update_bnb(payload, monkeypatch)

    assert reloaded.listing_type == "private_room"
    assert reloaded.max_guests == 6
    assert reloaded.bedrooms == 3
    assert reloaded.bathrooms == 2
    assert reloaded.bed_config == [{"type": "Queen", "qty": 2}]
    assert reloaded.price_unit == "week"
    assert reloaded.min_stay_nights == 2
    assert reloaded.max_stay_nights == 14
    assert reloaded.cleaning_fee == 700
    assert reloaded.security_deposit == 1200
    assert reloaded.extra_guest_fee == 150
    assert reloaded.available_from == date(2027, 3, 1)
    assert reloaded.available_until == date(2027, 4, 1)
    assert reloaded.check_in_time == "15:00"
    assert reloaded.check_out_time == "11:00"
    assert reloaded.advance_notice_hours == 24
    assert reloaded.house_rules == payload["bnb"]["house_rules"]
    assert reloaded.custom_rules == "Updated rules"
    assert reloaded.guest_suitability == ["families", "groups"]
    assert reloaded.nearby_landmark == "Updated landmark"


@pytest.mark.asyncio
async def test_nested_bnb_update_can_clear_nullable_fields(monkeypatch):
    _, reloaded, _ = await _update_bnb(
        {
            "bnb": {
                "max_guests": None,
                "bedrooms": None,
                "bathrooms": None,
                "max_stay_nights": None,
                "cleaning_fee": None,
                "security_deposit": None,
                "extra_guest_fee": None,
                "available_from": None,
                "available_until": None,
                "check_in_time": None,
                "check_out_time": None,
                "advance_notice_hours": None,
                "custom_rules": None,
                "nearby_landmark": None,
            }
        },
        monkeypatch,
    )

    for field in (
        "max_guests",
        "bedrooms",
        "bathrooms",
        "max_stay_nights",
        "cleaning_fee",
        "security_deposit",
        "extra_guest_fee",
        "available_from",
        "available_until",
        "check_in_time",
        "check_out_time",
        "advance_notice_hours",
        "custom_rules",
        "nearby_landmark",
    ):
        assert getattr(reloaded, field) is None
    assert reloaded.min_stay_nights == 1
    assert reloaded.listing_type == "entire_place"


@pytest.mark.asyncio
async def test_partial_nested_bnb_update_preserves_omitted_fields(monkeypatch):
    _, reloaded, _ = await _update_bnb(
        {"bnb": {"max_guests": 6}},
        monkeypatch,
    )

    assert reloaded.max_guests == 6
    assert reloaded.cleaning_fee == 500
    assert reloaded.security_deposit == 1000
    assert reloaded.bedrooms == 2
    assert reloaded.bed_config == [{"type": "Double", "qty": 1}]


@pytest.mark.asyncio
async def test_top_level_listing_fields_and_images_still_update(monkeypatch):
    payload = {
        "title": "Updated title",
        "description": "Updated listing description.",
        "price": 4200,
        "location": "Updated location",
        "county": "kirinyaga",
        "area": "Updated area",
        "specific_location": "Unit 4",
        "latitude": -0.42,
        "longitude": 36.95,
        "amenities": ["WiFi", "Kitchen"],
        "is_active": False,
        "images": [{"r2_url": "https://example.test/new.webp", "display_order": 0}],
        "bnb": {"max_guests": 5},
    }

    listing, reloaded_details, update_listing_mock = await _update_bnb(payload, monkeypatch)

    assert listing.title == "Updated title"
    assert listing.description == "Updated listing description."
    assert listing.price == 4200
    assert listing.location == "Updated location"
    assert listing.county == "kirinyaga"
    assert listing.area == "Updated area"
    assert listing.specific_location == "Unit 4"
    assert listing.latitude == -0.42
    assert listing.longitude == 36.95
    assert listing.amenities == ["WiFi", "Kitchen"]
    assert listing.is_active is False
    update_listing_mock.assert_awaited_once()
    update_data = update_listing_mock.await_args.kwargs["data"]
    assert update_data.images[0].r2_url == "https://example.test/new.webp"
    assert reloaded_details.max_guests == 5


def test_nested_update_rejects_null_for_non_nullable_columns():
    with pytest.raises(ValidationError):
        BnbListingUpdate(bnb={"listing_type": None})

    with pytest.raises(ValidationError):
        BnbListingUpdate(bnb={"house_rules": None})
