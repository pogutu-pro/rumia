from typing import Optional

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.device import get_device_id
from app.core.errors import NotFoundException
from app.core.permissions import AccessContext, get_access
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_current_user, get_optional_current_user
from app.features.catalog import lifecycle, reports
from app.features.catalog.schemas import ActionPreview, ActionResult, PropertyRead, ReportCreate, StatusChange
from app.features.catalog.service import get_property_read

router = APIRouter(tags=["Catalog"])

PUBLIC_CACHE = "public, max-age=60, stale-while-revalidate=300"


async def _scope(db: AsyncSession, property_id: str) -> tuple[Optional[str], Optional[str]]:
    row = (await db.execute(text("SELECT market_id, org_id FROM properties WHERE id = CAST(:p AS uuid)"), {"p": property_id})).first()
    if not row:
        raise NotFoundException("Property not found.")
    return (str(row[0]) if row[0] else None, str(row[1]) if row[1] else None)


@router.get("/properties/{slug}", response_model=PropertyRead, summary="Property",
            description="One place with its units, media, dated facts and distances. Live, stale, paused and let places "
                        "resolve (so a shared link never dead-ends); anything else is 404. Public.")
async def get_property(slug: str, response: Response, db: AsyncSession = Depends(get_db_session, scope="function")) -> PropertyRead:
    response.headers["Cache-Control"] = PUBLIC_CACHE
    return await get_property_read(db, slug)


@router.post("/properties/{property_id}/confirm", response_model=ActionResult, summary="Confirm Still Available")
async def confirm_property(property_id: str, access: AccessContext = Depends(get_access),
                           db: AsyncSession = Depends(get_db_session, scope="function")) -> ActionResult:
    market_id, org_id = await _scope(db, property_id)
    access.require("property.confirm", market_id=market_id, org_id=org_id)
    new = await lifecycle.confirm_available(db, property_id, actor_kind="lister", actor_id=access.user_id)
    return ActionResult(action="confirm", status=new)


@router.post("/properties/{property_id}/let", response_model=ActionResult, summary="Mark As Let / Full")
async def let_property(property_id: str, body: StatusChange = StatusChange(), access: AccessContext = Depends(get_access),
                       db: AsyncSession = Depends(get_db_session, scope="function")) -> ActionResult:
    market_id, org_id = await _scope(db, property_id)
    access.require("property.pause", market_id=market_id, org_id=org_id)
    new = await lifecycle.transition(db, property_id, "let", actor_kind="lister", actor_id=access.user_id, reason=body.reason)
    return ActionResult(action="let", status=new)


@router.post("/properties/{property_id}/pause", response_model=ActionResult, summary="Pause A Listing")
async def pause_property(property_id: str, body: StatusChange = StatusChange(), access: AccessContext = Depends(get_access),
                         db: AsyncSession = Depends(get_db_session, scope="function")) -> ActionResult:
    market_id, org_id = await _scope(db, property_id)
    access.require("property.pause", market_id=market_id, org_id=org_id)
    new = await lifecycle.transition(db, property_id, "paused", actor_kind="lister", actor_id=access.user_id, reason=body.reason)
    return ActionResult(action="pause", status=new)


@router.get("/actions/{token}", response_model=ActionPreview, summary="Preview A One-Tap Link",
            description="What a reconfirmation link will do. Has no side effects, so link previewers (WhatsApp, email scanners) are harmless.")
@limiter.limit("60/minute")
async def preview_action(request: Request, token: str, db: AsyncSession = Depends(get_db_session, scope="function")) -> ActionPreview:
    pid, action = lifecycle.read_action_token(token)
    row = (await db.execute(text("SELECT name, slug, status FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).first()
    if not row:
        raise NotFoundException("Property not found.")
    return ActionPreview(action=action, property_name=row[0], property_slug=row[1], current_status=row[2])


@router.post("/actions/{token}", response_model=ActionResult, summary="Do A One-Tap Action",
             description="Performs the confirm / let / pause action carried by a signed, expiring link. No sign-in.")
@limiter.limit("20/minute")
async def do_action(request: Request, token: str, db: AsyncSession = Depends(get_db_session, scope="function")) -> ActionResult:
    pid, action = lifecycle.read_action_token(token)
    if action == "confirm":
        new = await lifecycle.confirm_available(db, pid, actor_kind="lister")
    else:
        new = await lifecycle.transition(db, pid, lifecycle.ACTIONS[action], actor_kind="lister", reason="one-tap link")
    return ActionResult(action=action, status=new)


@router.post("/properties/{slug}/reports", status_code=status.HTTP_202_ACCEPTED, summary="Report A Listing",
             description="Not available, wrong price, scam, wrong location or other. Repeated reports from different "
                         "people trigger a reconfirmation or a review hold automatically. Public, rate limited.")
@limiter.limit("10/minute")
async def report_property(
    request: Request, slug: str, body: ReportCreate, device_id: Optional[str] = Depends(get_device_id),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> dict:
    await reports.submit_report(db, slug, body.reason, body.details, device_id, user.id if user else None)
    return {"received": True}
