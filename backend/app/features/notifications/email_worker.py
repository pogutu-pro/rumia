"""Email delivery worker — sends pending email_deliveries rows via Brevo.

The database (email_deliveries) is the source of truth; this worker only
executes sends and updates status. Callers enqueue `send_one` for immediate
sends, or `retry_pending` from cron for retry-eligible rows.
"""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.email import email_service
from app.core.email.templates import (
    wishlist_listing_available_email,
    wishlist_listing_updated_email,
    wishlist_price_updated_email,
)

logger = logging.getLogger(__name__)

MAX_RETRY_COUNT = 3
RETRY_BASE_DELAY_SECONDS = 60  # exponential backoff: 60s, 120s, 240s
BREVO_PACING_DELAY = 0.2  # ~5 emails/sec, conservative vs provider limits


def _listening_url(listing: dict) -> str:
    from app.core.config import settings

    slug = listing.get("slug")
    if not slug:
        return f"{settings.PUBLIC_BASE_URL}/hostels"
    county = listing.get("county") or "nyeri"
    area = listing.get("area") or "dekut"
    return f"{settings.PUBLIC_BASE_URL}/hostels/{county}/{area}/{slug}"


def _render_for_type(notification_type: str, user: dict, listing: dict, event_data: dict):
    """Render the correct branded email body for a notification type."""
    url = _listening_url(listing)
    user_name = (user.get("full_name") or user.get("email") or "there").split("@")[0]
    area = listing.get("area") or listing.get("location")

    if notification_type == "wishlist_listing_available":
        return wishlist_listing_available_email(
            user_name=user_name,
            listing_title=listing.get("title", "a hostel you wishlisted"),
            listing_area=area,
            listing_price=listing.get("price"),
            listing_url=url,
        )
    if notification_type == "wishlist_price_updated":
        return wishlist_price_updated_email(
            user_name=user_name,
            listing_title=listing.get("title", "a hostel you wishlisted"),
            listing_area=area,
            old_price=event_data.get("old_price"),
            new_price=event_data.get("new_price", listing.get("price")),
            listing_url=url,
        )
    # default: information update
    return wishlist_listing_updated_email(
        user_name=user_name,
        listing_title=listing.get("title", "a hostel you wishlisted"),
        listing_area=area,
        listing_url=url,
        update_summary=event_data.get("summary") or "The listing details have been updated.",
    )


class EmailDeliveryWorker:
    @staticmethod
    async def send_one(delivery_id: str) -> None:
        """Send a single pending email_delivery row."""
        from app.features.notifications.models import EmailDelivery

        async with async_session_factory() as session:
            res = await session.execute(select(EmailDelivery).where(EmailDelivery.id == delivery_id))
            delivery = res.scalar_one_or_none()
            if not delivery:
                logger.warning("Email delivery %s not found", delivery_id)
                return
            if delivery.status in ("sent", "delivered", "bounced", "blocked", "cancelled"):
                return

            delivery.status = "sending"
            delivery.error_message = None
            await session.commit()

            user_res = await session.execute(
                select_from_profiles(delivery.user_id)[0],
                select_from_profiles(delivery.user_id)[1],
            )
            user = user_res.mappings().first()
            if not user or not user.get("email"):
                delivery.status = "failed"
                delivery.error_message = "user has no email"
                await session.commit()
                return

            listing = None
            if delivery.listing_id:
                listing_sql, listing_params = select_listing(delivery.listing_id)
                listing_res = await session.execute(listing_sql, listing_params)
                listing = listing_res.mappings().first()

            rendered = _render_for_type(
                notification_type=delivery.notification_type,
                user=dict(user),
                listing=dict(listing) if listing else {},
                event_data=dict(delivery.payload) if delivery.payload else {},
            )

            result = await email_service.send(
                to_email=delivery.to_email,
                to_name=user.get("full_name"),
                subject=delivery.subject,
                html_content=rendered.html,
                text_content=rendered.text,
                tags=["wishlist", delivery.notification_type, delivery.template_name],
            )

            if result.success:
                # Brevo can reject accepted sends asynchronously (e.g. an
                # unvalidated sender). Confirm the real state before marking
                # the delivery as sent so the DB mirrors provider truth.
                async_rejection = None
                if result.provider_message_id:
                    status = await email_service.check_status(result.provider_message_id)
                    if status is not None:
                        provider_status, reason = status
                        from app.core.integrations.brevo import REJECTED_STATUSES

                        if provider_status in REJECTED_STATUSES:
                            async_rejection = reason or f"provider rejected send ({provider_status})"
                        elif provider_status == "delivered":
                            delivery.status = "delivered"

                if async_rejection:
                    delivery.status = "failed"
                    delivery.error_message = async_rejection
                    delivery.sent_at = datetime.now(timezone.utc)
                    await session.commit()
                    logger.warning(
                        "Email delivery %s marked failed after provider check: %s",
                        delivery.id,
                        async_rejection,
                    )
                    return

                delivery.provider_message_id = result.provider_message_id
                delivery.sent_at = datetime.now(timezone.utc)
                delivery.error_message = None
                if delivery.status != "delivered":
                    delivery.status = "sent"
                await session.commit()
                logger.info(
                    "Email delivery %s sent via %s message_id=%s",
                    delivery.id,
                    email_service.provider_name,
                    result.provider_message_id,
                )
            else:
                delivery.retry_count += 1
                delivery.status = "deferred" if delivery.retry_count < MAX_RETRY_COUNT else "failed"
                delivery.error_message = result.error_message
                await session.commit()
                logger.warning(
                    "Email delivery %s %s: %s",
                    delivery.id,
                    "deferred for retry" if delivery.status == "deferred" else "failed",
                    result.error_message,
                )

    @staticmethod
    async def retry_pending() -> None:
        """Retry pending/sending/deferred/failed rows that are retry-eligible."""
        from app.features.notifications.models import EmailDelivery

        async with async_session_factory() as session:
            res = await session.execute(
                select(EmailDelivery.id)
                .where(
                    EmailDelivery.status.in_(("pending", "sending", "deferred", "failed")),
                    EmailDelivery.retry_count < MAX_RETRY_COUNT,
                )
                .order_by(EmailDelivery.created_at.asc())
                .limit(200)
            )
            ids = [row[0] for row in res.all()]

        for delivery_id in ids:
            await EmailDeliveryWorker.send_one(str(delivery_id))
            await asyncio.sleep(BREVO_PACING_DELAY)

        if ids:
            logger.info("retry_pending processed %d email delivery rows", len(ids))


def select_from_profiles(user_id: str):
    from sqlalchemy import text as sa_text

    return sa_text(
        """
        SELECT id, email, full_name
        FROM profiles
        WHERE id = CAST(:user_id AS uuid)
        """
    ), {"user_id": user_id}


def select_listing(listing_id: str):
    from sqlalchemy import text as sa_text

    return sa_text(
        """
        SELECT id, title, slug, price, county, area, location
        FROM listings
        WHERE id = CAST(:listing_id AS uuid)
        """
    ), {"listing_id": listing_id}