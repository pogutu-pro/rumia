"""Unit tests for WishlistNotificationService.process_event (event dispatch)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.security import AuthenticatedUser
from app.features.notifications.wishlist_service import WishlistNotificationService


class _Result:
    def __init__(self, mappings_items=None, rowcount=0):
        self._items = mappings_items or []
        self.rowcount = rowcount

    def mappings(self):
        m = MagicMock()
        m.first.return_value = self._items[0] if self._items else None
        m.all.return_value = self._items
        return m


def _listing_row():
    return {"id": "listing-1", "title": "Sunrise Hostel", "slug": "sunrise-hostel",
            "price": 6500, "area": "dekut", "location": "near gate"}


def _make_session(results: list):
    """Session whose execute() pops results per call."""
    session = AsyncMock()
    session.execute = AsyncMock(side_effect=results)
    session.commit = AsyncMock(return_value=None)
    session.flush = AsyncMock(return_value=None)
    session.add = MagicMock()
    return session


@pytest.mark.asyncio
async def test_process_event_unknown_listing_skips():
    session = _make_session([_Result(mappings_items=[])])
    await WishlistNotificationService.process_event(
        db=session, listing_id="missing", notification_type="wishlist_listing_available"
    )
    session.commit.assert_not_awaited()  # nothing worth persisting


@pytest.mark.asyncio
async def test_process_event_no_wishlist_users_skips():
    session = _make_session([
        _Result(mappings_items=[_listing_row()]),
        _Result(mappings_items=[]),  # wishlist users: none
    ])
    await WishlistNotificationService.process_event(
        db=session, listing_id="listing-1", notification_type="wishlist_listing_available"
    )
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_process_event_dispatches_and_dedups():
    """One user wishlisted the listing -> in-app + email + push dispatched."""
    session = _make_session([
        _Result(mappings_items=[_listing_row()]),        # listing
        _Result(mappings_items=[{"user_id": "user-1"}]),  # wishlist users
        _Result(rowcount=1),                              # _claim_event -> claimed
        _Result(),                                        # _insert_in_app (no-op result)
        _Result(mappings_items=[{"enabled": True}]),      # email pref
        _Result(mappings_items=[{"email": "u@rumia.app"}]),  # profile email
        _Result(mappings_items=[{"enabled": True}]),      # push pref
    ])

    email_send = AsyncMock()
    push_send = AsyncMock()
    with patch(
        "app.features.notifications.wishlist_service._send_email_delivery", new=email_send
    ), patch(
        "app.features.notifications.wishlist_service._send_pushes", new=push_send
    ):
        await WishlistNotificationService.process_event(
            db=session,
            listing_id="listing-1",
            notification_type="wishlist_listing_available",
            event_data={"test": True},
        )

    session.commit.assert_awaited_once()
    email_send.assert_awaited_once()
    push_send.assert_awaited_once()


@pytest.mark.asyncio
async def test_process_event_respects_email_opt_out():
    session = _make_session([
        _Result(mappings_items=[_listing_row()]),
        _Result(mappings_items=[{"user_id": "user-1"}]),
        _Result(rowcount=1),
        _Result(),                                        # _insert_in_app
        _Result(mappings_items=[{"enabled": False}]),     # email disabled
        _Result(mappings_items=[{"enabled": True}]),      # push pref
    ])

    email_send = AsyncMock()
    push_send = AsyncMock()
    with patch(
        "app.features.notifications.wishlist_service._send_email_delivery", new=email_send
    ), patch(
        "app.features.notifications.wishlist_service._send_pushes", new=push_send
    ):
        await WishlistNotificationService.process_event(
            db=session,
            listing_id="listing-1",
            notification_type="wishlist_price_updated",
            event_data={"old_price": 5000, "new_price": 6500},
        )

    session.commit.assert_awaited_once()
    email_send.assert_not_awaited()
    push_send.assert_awaited_once()


@pytest.mark.asyncio
async def test_process_event_dedup_skips_already_notified_user():
    """_claim_event returning rowcount=0 means the user was already notified."""
    session = _make_session([
        _Result(mappings_items=[_listing_row()]),
        _Result(mappings_items=[{"user_id": "user-1"}]),
        _Result(rowcount=0),  # already claimed this window
    ])
    email_send = AsyncMock()
    push_send = AsyncMock()
    with patch(
        "app.features.notifications.wishlist_service._send_email_delivery", new=email_send
    ), patch(
        "app.features.notifications.wishlist_service._send_pushes", new=push_send
    ):
        await WishlistNotificationService.process_event(
            db=session, listing_id="listing-1", notification_type="wishlist_listing_updated"
        )

    session.commit.assert_awaited_once()
    email_send.assert_not_awaited()
    push_send.assert_not_awaited()