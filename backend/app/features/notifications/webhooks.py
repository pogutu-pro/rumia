"""Webhook endpoints for external service callbacks (Brevo delivery events).

All webhooks use Bearer token verification. No authenticated user is
involved; these are signed provider callbacks from Brevo to update
`email_deliveries` status (delivered / bounced / blocked / deferred / opened).
"""
import logging
import secrets

from sqlalchemy import text
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import settings
from app.core.database import get_db_session
from app.core.integrations.brevo import BrevoProvider
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# Map normalized Brevo events to email_deliveries statuses.
EVENT_TO_STATUS = {
    "delivered": "delivered",
    "bounce": "bounced",
    "blocked": "blocked",
    "deferred": "deferred",
    "complaint": "blocked",
    "spam": "blocked",
}


def _verify_bearer_token(request: Request) -> bool:
    """Verify the Authorization header contains a valid Bearer token."""
    if not settings.BREVO_WEBHOOK_SECRET:
        return False
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header:
        return False
    if not auth_header.startswith("Bearer "):
        return False
    provided = auth_header[7:]  # strip "Bearer "
    return secrets.compare_digest(provided, settings.BREVO_WEBHOOK_SECRET)


@router.post(
    "/brevo",
    status_code=status.HTTP_200_OK,
    summary="Brevo Delivery Events",
    description="Update email delivery status from Brevo callback events. Bearer token auth; no auth required.",
    include_in_schema=False,
)
async def brevo_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if not _verify_bearer_token(request):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook token")

    import json

    body = await request.body()
    try:
        payload = json.loads(body)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")

    events = BrevoProvider().parse_webhook(payload)
    updated = 0
    for event in events:
        new_status = EVENT_TO_STATUS.get(event.event)
        if not new_status:
            # opened/clicked don't change delivery status
            continue
        res = await db.execute(
            text("""
                UPDATE email_deliveries
                SET status = :status,
                    delivered_at = CASE WHEN :status = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
                    error_message = :reason,
                    updated_at = now()
                WHERE provider_message_id = :message_id
            """),
            {
                "status": new_status,
                "message_id": event.provider_message_id,
                "reason": event.reason,
            },
        )
        updated += (res.rowcount or 0)

    await db.commit()
    logger.info("Brevo webhook processed %d email events (%d rows updated)", len(events), updated)
    return {"received": len(events), "updated": updated}