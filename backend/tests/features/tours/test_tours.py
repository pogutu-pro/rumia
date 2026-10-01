import pytest
from httpx import AsyncClient

from app.core.security import AuthenticatedUser, get_current_user
from app.main import app


@pytest.mark.asyncio
async def test_list_tours_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/tours")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_tours_agent(client: AsyncClient):
    user = AuthenticatedUser(id="agent-1", email="agent@rumia.app", role="agent")
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = await client.get("/api/v1/tours")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_my_tours_embeds_listing_and_supports_upcoming_sort(client: AsyncClient):
    from datetime import date, datetime, timezone
    from unittest.mock import AsyncMock, MagicMock, patch

    from app.core.security import AuthenticatedUser, get_current_user
    from app.main import app

    booking = MagicMock()
    for key, value in dict(
        id="b1", student_name="Student", phone="0700000000", listing_id="l1", zone="Z",
        tour_type="specific_hostel", amount=500, preferred_date=date(2026, 11, 1),
        preferred_time="morning", status="confirmed", linked_user_id="u1", agent_id=None,
        contacted=False, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    ).items():
        setattr(booking, key, value)

    booking.listing = None  # the ORM model has no such attribute
    image = MagicMock(r2_url="https://img/1.jpg", display_order=0)
    listing = MagicMock(id="l1", title="Hostel One", area="Area", county="Nyeri", slug="hostel-one", images=[image])

    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id="u1", email="s@r.app", role="student")
    try:
        with (
            patch("app.features.tours.service.TourService.list_my_tours", new_callable=AsyncMock,
                  return_value=([booking], 1)) as list_mock,
            patch("app.features.tours.service.TourService.get_listings_by_id", new_callable=AsyncMock,
                  return_value={"l1": listing}),
        ):
            response = await client.get("/api/v1/tours/me?sort=upcoming")
        assert response.status_code == 200
        assert list_mock.await_args.kwargs["sort"] == "upcoming"
        item = response.json()["items"][0]
        assert item["listing"]["title"] == "Hostel One"
        assert item["listing"]["images"][0]["r2_url"] == "https://img/1.jpg"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_my_tours_rejects_unknown_sort(client: AsyncClient):
    from app.core.security import AuthenticatedUser, get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id="u1", email="s@r.app", role="student")
    try:
        response = await client.get("/api/v1/tours/me?sort=bogus")
        assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ── Service-level rules (DB scripted in call order) ──────────────────────────────

from datetime import date, timedelta  # noqa: E402
from types import SimpleNamespace  # noqa: E402
from unittest.mock import AsyncMock, MagicMock  # noqa: E402

from app.core.errors import APIException  # noqa: E402
from app.features.tours.schemas import TourBookingCreate, TourBookingStudentUpdate, TourBookingUpdateStatus  # noqa: E402
from app.features.tours.service import TourService, _today_nairobi  # noqa: E402
from tests.conftest import MockResult  # noqa: E402

AGENT_ID = "9a1b2c3d-36bf-455d-b21f-14471ec16312"
STUDENT = "8f853c92-36bf-455d-b21f-14471ec16311"
FUTURE = _today_nairobi() + timedelta(days=3)


def _db(*results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.flush = AsyncMock()
    db.delete = AsyncMock()
    return db


def _create(**kw):
    base = dict(student_name="Jane Student", phone="+254712345678", zone="Boma", tour_type="full_search",
                preferred_date=FUTURE, preferred_time="morning")
    base.update(kw)
    return TourBookingCreate(**base)


def _booking(status="pending_payment", agent_id=AGENT_ID, linked=STUDENT):
    return SimpleNamespace(
        id="b1", status=status, agent_id=agent_id, linked_user_id=linked, student_name="Jane",
        preferred_date=FUTURE, preferred_time="morning", phone="0712345678", updated_at=None,
    )


class _Rows:
    """Result whose .scalars().all() yields rows (price lookup)."""

    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return SimpleNamespace(all=lambda: self._rows)


@pytest.mark.asyncio
async def test_create_prices_from_zone_never_from_client():
    db = _db(
        _Rows([1500]),                      # zone price
        MockResult(single=AGENT_ID),        # no agent/listing given -> first-agent fallback
        MockResult(single="agent-user-1"),  # agent's user id
        _Rows(["admin-1", "admin-2"]),      # admin ids
    )
    booking, pushes = await TourService.create_booking(db, _create(), SimpleNamespace(id=STUDENT, email="s@r.app"))
    assert booking.amount == 1500
    assert booking.linked_user_id == STUDENT
    assert booking.agent_id == AGENT_ID
    recipients = [p.user_id for p in pushes]
    assert recipients == ["agent-user-1", STUDENT, "admin-1", "admin-2"]


@pytest.mark.asyncio
async def test_create_rejects_unpriced_zone_past_date_and_bad_phone():
    with pytest.raises(APIException) as exc:
        await TourService.create_booking(_db(_Rows([])), _create(), None)
    assert exc.value.status_code == 400 and "No pricing" in exc.value.detail["message"]

    with pytest.raises(APIException) as exc:
        await TourService.create_booking(_db(), _create(preferred_date=date(2020, 1, 1)), None)
    assert "future" in exc.value.detail["message"]

    with pytest.raises(APIException) as exc:
        await TourService.create_booking(_db(), _create(phone="abc-def-ghi"), None)
    assert "phone" in exc.value.detail["message"]


@pytest.mark.asyncio
async def test_ambiguous_zone_name_has_no_price():
    # Two active campuses with the same zone name and no campus given -> refuse to guess.
    assert await TourService.get_zone_price(_db(_Rows([500, 700])), "Boma", None) is None


@pytest.mark.asyncio
async def test_agent_applies_allowed_transition_and_notifies_student():
    db = _db(MockResult(single=_booking()), _Rows([AGENT_ID]))
    booking, pushes = await TourService.update_booking_status(
        db, SimpleNamespace(id="agent-user", is_admin=False), "b1", TourBookingUpdateStatus(status="paid"))
    assert booking.status == "paid"
    assert [p.user_id for p in pushes] == [STUDENT] and "payment received" in pushes[0].body


@pytest.mark.asyncio
async def test_invalid_transition_is_rejected():
    db = _db(MockResult(single=_booking(status="completed")), _Rows([AGENT_ID]))
    with pytest.raises(APIException) as exc:
        await TourService.update_booking_status(
            db, SimpleNamespace(id="agent-user", is_admin=False), "b1", TourBookingUpdateStatus(status="paid"))
    assert exc.value.status_code == 400 and "Cannot transition" in exc.value.detail["message"]


@pytest.mark.asyncio
async def test_other_agent_is_forbidden():
    db = _db(MockResult(single=_booking()), _Rows(["some-other-agent"]))
    with pytest.raises(APIException) as exc:
        await TourService.update_booking_status(
            db, SimpleNamespace(id="x", is_admin=False), "b1", TourBookingUpdateStatus(status="paid"))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_student_may_only_cancel_own_pending_or_confirmed_booking():
    me = SimpleNamespace(id=STUDENT, is_admin=False)
    ok_db = _db(MockResult(single=_booking(status="confirmed")), _Rows([]), MockResult(single="agent-user-1"))
    booking, pushes = await TourService.update_booking_status(ok_db, me, "b1", TourBookingUpdateStatus(status="cancelled"))
    assert booking.status == "cancelled" and [p.user_id for p in pushes] == ["agent-user-1"]

    with pytest.raises(APIException) as exc:   # students cannot mark paid
        await TourService.update_booking_status(
            _db(MockResult(single=_booking()), _Rows([])), me, "b1", TourBookingUpdateStatus(status="paid"))
    assert exc.value.status_code == 403

    with pytest.raises(APIException) as exc:   # too late to cancel
        await TourService.update_booking_status(
            _db(MockResult(single=_booking(status="paid")), _Rows([])), me, "b1", TourBookingUpdateStatus(status="cancelled"))
    assert exc.value.status_code == 400

    stranger = SimpleNamespace(id="someone-else", is_admin=False)
    with pytest.raises(APIException) as exc:   # not their booking
        await TourService.update_booking_status(
            _db(MockResult(single=_booking()), _Rows([])), stranger, "b1", TourBookingUpdateStatus(status="cancelled"))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_student_edit_only_own_pending_booking():
    me = SimpleNamespace(id=STUDENT, is_admin=False)
    db = _db(MockResult(single=_booking()), MockResult(single="agent-user-1"))
    booking, pushes = await TourService.update_my_booking(
        db, me, "b1", TourBookingStudentUpdate(preferred_time="evening", phone="0799999999"))
    assert booking.preferred_time == "evening" and booking.phone == "0799999999"
    assert [p.user_id for p in pushes] == ["agent-user-1"]

    with pytest.raises(APIException) as exc:
        await TourService.update_my_booking(_db(MockResult(single=_booking(status="confirmed"))), me, "b1", TourBookingStudentUpdate(phone="0799999999"))
    assert exc.value.status_code == 400

    with pytest.raises(APIException) as exc:
        await TourService.update_my_booking(
            _db(MockResult(single=_booking())), SimpleNamespace(id="x", is_admin=False), "b1", TourBookingStudentUpdate(phone="0799999999"))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_delete_is_for_the_agent_or_admin_only():
    db = _db(MockResult(single=_booking()), _Rows([AGENT_ID]))
    await TourService.delete_booking(db, SimpleNamespace(id="agent-user", is_admin=False), "b1")
    db.delete.assert_awaited_once()

    with pytest.raises(APIException) as exc:
        await TourService.delete_booking(_db(MockResult(single=_booking()), _Rows([])), SimpleNamespace(id=STUDENT, is_admin=False), "b1")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_create_endpoint_requires_zone_price_and_ignores_client_amount(client: AsyncClient):
    payload = {"student_name": "Jane Student", "phone": "+254712345678", "zone": "Gate A",
               "tour_type": "full_search", "amount": 1, "preferred_date": FUTURE.isoformat(),
               "preferred_time": "morning"}
    response = await client.post("/api/v1/tours", json=payload)   # mock DB has no zone -> no price
    assert response.status_code == 400
