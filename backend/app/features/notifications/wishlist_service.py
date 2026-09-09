"""Wishlist notification dispatch — event-driven, DB-as-source-of-truth.

`WishlistNotificationService.process_event` is called from the background
worker when a listing is updated (availability / price / info). It:

  1. Dedups per (user, listing, notification_type) within a 1h window.
  2. Creates an in-app notification for every wishlist user (baseline channel).
  3. If email consent is on, inserts an `email_deliveries` row and sends it via
     the email provider (paced).
  4. If push consent is on, dispatches to all active web/mobile tokens.

Recipients are server-determined (wishlist members only). There is no public
"send to user" endpoint and landlords cannot pick recipients.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Dedup window: repeated events for the same (listing, type) collapse to one
# per user per window, so a landlord toggling availability repeatedly never
# spams wishlisters.
DEDUP_WINDOW_FORMAT = "%Y-%m-%d-%H"
EMAIL_PACING_SECONDS = 0.25

IN_APP_TITLES: Dict[str, str] = {
    "wishlist_listing_available": "A hostel you wishlisted is now available",
    "wishlist_price_updated": "Price updated on a wishlisted hostel",
    "wishlist_listing_updated": "A listing you wishlisted was updated",
}

EMAIL_SUBJECTS: Dict[str, str] = {
    "wishlist_listing_available": "A hostel you wishlisted is now available",
    "wishlist_price_updated": "Price updated on a wishlisted hostel",
    "wishlist_listing_updated": "A listing you wishlisted was updated",
}

TEMPLATE_NAMES: Dict[str, str] = {
    "wishlist_listing_available": "wishlist_listing_available",
    "wishlist_price_updated": "wishlist_price_updated",
    "wishlist_listing_updated": "wishlist_listing_updated",
}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _in_app_content(notification_type: str, listing: dict, event_data: dict):
    """Return (title, body, url) for the in-app notification row."""
    title = IN_APP_TITLES.get(notification_type, "A listing you wishlisted was updated")
    listing_title = listing.get("title") or "A hostel you wishlisted"
    area = listing.get("area") or listing.get("location") or "in your area"
    slug = listing.get("slug")
    url = f"/hostels/{area.replace(' ', '-').lower()}/{slug}" if slug else "/hostels"

    if notification_type == "wishlist_listing_available":
        body = f"{listing_title} in {area} is now available. Rooms are opening up — head over to secure yours before they fill."
    elif notification_type == "wishlist_price_updated":
        old_price = event_data.get("old_price")
        new_price = event_data.get("new_price", listing.get("price"))
        if old_price and new_price and old_price != new_price:
            body = f"The price for {listing_title} changed from KES {old_price:,} to KES {new_price:,}."
        else:
            body = f"The price for {listing_title} in {area} has been updated."
    else:
        body = f"{listing_title} in {area} has new updates — check out what changed."
    return title, body, url


class WishlistNotificationService:
    @staticmethod
    async def process_event(
        db: AsyncSession,
        listing_id: str,
        notification_type: str,
        event_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Dispatch a listing event to all wishlist members.

        Runs inside the background worker. Safe to call repeatedly: idempotent
        via `wishlist_notification_events.event_key` and delivery
        `idempotency_key` unique constraints.
        """
        event_data = event_data or {}

        listing = await _get_listing(db, listing_id)
        if not listing:
            logger.warning("Wishlist event for unknown listing %s — skipping", listing_id)
            return

        wishlist_users = await _wishlisted_user_ids(db, listing_id)
        if not wishlist_users:
            return

        window = _now_utc().strftime(DEDUP_WINDOW_FORMAT)
        template_name = TEMPLATE_NAMES.get(notification_type, "wishlist_listing_updated")
        email_delivery_ids: list[str] = []
        push_batch: list[dict] = []

        for user_id in wishlist_users:
            if not await _claim_event(db, user_id, listing_id, notification_type, window):
                continue  # this user was already notified in this window

            title, body, url = _in_app_content(notification_type, listing, event_data)
            await _insert_in_app(db, user_id, title, body, url, notification_type)

            if await _preference(db, user_id, "email") and not event_data.get("skip_email"):
                delivery_id = await _insert_email_delivery(
                    db, user_id, listing_id, notification_type, template_name, event_data, window
                )
                if delivery_id:
                    email_delivery_ids.append(delivery_id)

            if await _preference(db, user_id, "push") and not event_data.get("skip_push"):
                push_batch.append(
                    {
                        "user_id": user_id,
                        "title": title,
                        "body": body,
                        "url": url,
                        "window": window,
                    }
                )

        await db.commit()

        # Dispatch sends after the DB commit; sends run in their own sessions.
        for delivery_id in email_delivery_ids:
            await _send_email_delivery(delivery_id)
            await asyncio.sleep(EMAIL_PACING_SECONDS)

        for item in push_batch:
            await _send_pushes(
                user_id=item["user_id"],
                title=item["title"],
                body=item["body"],
                url=item["url"],
                notification_type=notification_type,
                listing_id=listing_id,
                window=item["window"],
            )


async def _get_listing(db: AsyncSession, listing_id: str) -> Optional[dict]:
    res = await db.execute(
        text("""
            SELECT id, title, slug, price, area, location
            FROM listings
            WHERE id = :listing_id
        """),
        {"listing_id": listing_id},
    )
    return res.mappings().first()


async def _wishlisted_user_ids(db: AsyncSession, listing_id: str) -> list[str]:
    res = await db.execute(
        text("SELECT user_id FROM wishlists WHERE listing_id = :listing_id"),
        {"listing_id": listing_id},
    )
    return [str(row["user_id"]) for row in res.mappings().all()]


async def _claim_event(
    db: AsyncSession,
    user_id: str,
    listing_id: str,
    notification_type: str,
    window: str,
) -> bool:
    """Insert the dedup row; returns False if this user already received the event."""
    event_key = f"{user_id}:{listing_id}:{notification_type}:{window}"
    res = await db.execute(
        text("""
            INSERT INTO wishlist_notification_events (user_id, listing_id, notification_type, event_key, created_at)
            VALUES (:user_id, :listing_id, :notification_type, :event_key, now())
            ON CONFLICT (event_key) DO NOTHING
        """),
        {
            "user_id": user_id,
            "listing_id": listing_id,
            "notification_type": notification_type,
            "event_key": event_key,
        },
    )
    return (res.rowcount or 0) > 0


async def _insert_in_app(
    db: AsyncSession,
    user_id: str,
    title: str,
    body: str,
    url: str,
    notification_type: str,
) -> None:
    await db.execute(
        text("""
            INSERT INTO app_notifications (user_id, title, body, url, type, is_read, created_at)
            VALUES (:user_id, :title, :body, :url, :type, false, now())
        """),
        {
            "user_id": user_id,
            "title": title,
            "body": body,
            "url": url,
            "type": notification_type,
        },
    )


async def _preference(db: AsyncSession, user_id: str, channel: str) -> bool:
    """Respect user channel consent. Missing row = consent (existing behavior)."""
    col = "wishlist_email_enabled" if channel == "email" else "wishlist_push_enabled"
    res = await db.execute(
        text(f"""
            SELECT {col} AS enabled
            FROM notification_preferences
            WHERE user_id = :user_id
        """),
        {"user_id": user_id},
    )
    row = res.mappings().first()
    return bool(row["enabled"]) if row else True


async def _insert_email_delivery(
    db: AsyncSession,
    user_id: str,
    listing_id: str,
    notification_type: str,
    template_name: str,
    event_data: dict,
    window: str,
) -> Optional[str]:
    from app.features.notifications.models import EmailDelivery

    profile = (
        await db.execute(
            text("SELECT email FROM profiles WHERE id = :user_id"),
            {"user_id": user_id},
        )
    ).mappings().first()
    if not profile or not profile.get("email"):
        logger.info("No email for user %s — skipping email delivery", user_id)
        return None

    idempotency_key = f"event:{user_id}:{listing_id}:{notification_type}:{window}"
    delivery = EmailDelivery(
        user_id=user_id,
        listing_id=listing_id,
        notification_type=notification_type,
        to_email=profile["email"],
        subject=EMAIL_SUBJECTS.get(notification_type, "A listing you wishlisted was updated"),
        template_name=template_name,
        status="pending",
        provider="brevo",
        retry_count=0,
        idempotency_key=idempotency_key,
        payload=event_data,
    )
    db.add(delivery)
    await db.flush()
    return str(delivery.id)


async def _send_email_delivery(delivery_id: str) -> None:
    from app.features.notifications.email_worker import EmailDeliveryWorker

    try:
        await EmailDeliveryWorker.send_one(delivery_id)
    except Exception as exc:
        logger.exception("Wishlist email send failed for delivery %s: %s", delivery_id, exc)


async def _send_pushes(
    user_id: str,
    title: str,
    body: str,
    url: str,
    notification_type: str,
    listing_id: str,
    window: str,
) -> None:
    from app.core.tasks.worker import send_push_to_user

    idempotency_key = f"event:{user_id}:{listing_id}:{notification_type}:{window}"
    await send_push_to_user(
        user_id=user_id,
        title=title,
        message=body,
        data={
            "type": notification_type,
            "url": url,
            "listing_id": listing_id,
        },
        with_inapp=False,
        idempotency_key=idempotency_key,
    )