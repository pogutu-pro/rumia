from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.features.public.service import PublicService


def _db(rows):
    db = MagicMock()
    result = MagicMock()
    result.all.return_value = rows
    db.execute = AsyncMock(return_value=result)
    return db


def _row(mpesa="Till 123456", **kw):
    listing = SimpleNamespace(
        id="l1", title="Baraka", county="nyeri", area="Boma", slug="baraka-boma",
        landlord_phone="0712345678", verified=True, mpesa_details=mpesa, specific_location=None, **kw,
    )
    agent = SimpleNamespace(phone="0722000111", whatsapp="0722000111", verified=True)
    return (listing, agent)


@pytest.mark.asyncio
async def test_short_or_empty_queries_return_nothing_without_querying():
    db = _db([])
    assert await PublicService.verify_lookup(db, "  ") == []
    assert await PublicService.verify_lookup(db, "ab") == []
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_payment_details_only_returned_when_searching_by_them():
    # Searching by phone: the listing matches but its payment details are not disclosed.
    out = await PublicService.verify_lookup(_db([_row()]), "0712345678")
    assert out and out[0].mpesa_details is None

    # Searching by the payment detail itself returns it (the visitor already has it).
    out = await PublicService.verify_lookup(_db([_row()]), "123456 till")
    assert out and out[0].mpesa_details == "Till 123456"

    # Searching by name never discloses payment details.
    out = await PublicService.verify_lookup(_db([_row()]), "Baraka")
    assert out and out[0].mpesa_details is None
