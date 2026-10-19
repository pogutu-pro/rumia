"""RumiaBnB stays API: guests (no account), hosts (their organisation's stays), staff (the concierge)."""
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db_session
from app.core.device import get_device_id
from app.core.errors import BadRequestException, ForbiddenException
from app.core.permissions import AccessContext, get_access
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_current_user, get_optional_current_user
from app.core.tasks.worker import send_push_to_user
from app.features.stays.schemas import (
    AgreementCreate, AgreementRead, ClaimBody, ClaimResult, HostAdminRow, HostOrg, InviteRead, ConciergeContactCreate, ConciergeContactResult, ContactRow, GuestReport,
    GuestStayView, HostConfirm, HostDecline, HostReport, HostSummary, OpsStatusChange, OpsStayCreate, QuoteRead,
    StayDetail, StayRequestCreate, StayRequestCreated, StayRow, StayStatus,
)
from app.features.stays import hosts as host_service
from app.features.stays.service import StayService, today

router = APIRouter(tags=["Stays"])


def _quote_read(q) -> QuoteRead:
    return QuoteRead(
        nights=q.nights, rate_basis=q.rate_basis, room_total=float(q.room_total),
        cleaning_fee=float(q.cleaning_fee) if q.cleaning_fee is not None else None, total=float(q.total),
    )


def _need_staff(access: AccessContext) -> None:
    if not access.can_staff_anywhere("bnb.concierge"):
        raise ForbiddenException("You do not have permission to do that.")


async def _notify_hosts(background_tasks: BackgroundTasks, db: AsyncSession, created: dict, guest_name: str) -> None:
    listing = created["listing"]
    q = created["quote"]
    for user_id in await StayService.host_user_ids(db, created["org_id"], listing):
        background_tasks.add_task(
            send_push_to_user, user_id, "New booking request",
            f"{guest_name} asked for {listing.title}, {q.nights} night(s). Ref {created['ref_code']}.",
            {"url": f"{settings.BNB_PUBLIC_URL.rstrip('/')}/host", "type": "stay_request"},
        )


# ── Guests ──────────────────────────────────────────────────────────────────────────────────────────────────


@router.get("/stays/quote", response_model=QuoteRead, summary="Price For Dates",
            description="The price of a stay for these dates (nightly, or the owner's weekly/monthly rate), before any request.")
async def stay_quote(
    listing: str, check_in: date, check_out: date, guests: int = Query(1, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> QuoteRead:
    found, bnb = await StayService.resolve_listing(db, listing)
    StayService.check_dates(found, bnb, check_in, check_out, guests)
    return _quote_read(StayService.quote(found, bnb, check_in, check_out))


@router.post("/stays/requests", response_model=StayRequestCreated, status_code=status.HTTP_201_CREATED,
             summary="Request A Stay",
             description="A guest asks to book dates. No account needed. The host confirms or declines; the guest follows "
                         "the request at /r/{token}. Rate limited. Public.")
@limiter.limit("10/minute")
async def request_stay(
    request: Request,
    data: StayRequestCreate,
    background_tasks: BackgroundTasks,
    device_id: Optional[str] = Depends(get_device_id),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> StayRequestCreated:
    created = await StayService.create_request(
        db, listing_ident=data.listing, check_in=data.check_in, check_out=data.check_out, guests=data.guests,
        guest_name=data.guest_name, guest_phone=data.guest_phone, guest_email=data.guest_email, note=data.note,
        attribution=data.attribution, origin="guest", device_id=device_id, user_id=user.id if user else None,
        session_id=data.session_id,
    )
    if not created["duplicate"]:
        await _notify_hosts(background_tasks, db, created, data.guest_name.strip())
    return StayRequestCreated(
        ref_code=created["ref_code"], token=created["token"], status=created["status"],
        listing_title=created["listing"].title, quote=_quote_read(created["quote"]),
    )


def _guest_view(req: dict, slug: Optional[str]) -> GuestStayView:
    started = req["check_in"] <= today()
    return GuestStayView(
        ref_code=req.get("ref_code"), status=req["status"], listing_title=req["listing_title"], listing_slug=slug,
        check_in=req["check_in"], check_out=req["check_out"], nights=req["nights"], guests=req["guests"],
        quoted_total=float(req["quoted_total"]), agreed_total=float(req["agreed_total"]) if req.get("agreed_total") is not None else None,
        host_note=req.get("host_note"), guest_report=req.get("guest_report"),
        can_cancel=req["status"] in ("requested", "confirmed") and not started,
        can_report=req["status"] in ("confirmed", "completed", "no_show") and started,
    )


async def _slug(db: AsyncSession, listing_id) -> Optional[str]:
    from sqlalchemy import text

    if not listing_id:
        return None
    return (await db.execute(text("SELECT slug FROM listings WHERE id = :l"), {"l": listing_id})).scalar_one_or_none()


@router.get("/stays/requests/{token}", response_model=GuestStayView, summary="My Booking Request",
            description="The guest's view of their request, by the secret token from the confirmation.")
@limiter.limit("60/minute")
async def my_stay(request: Request, token: str, db: AsyncSession = Depends(get_db_session, scope="function")) -> GuestStayView:
    req = await StayService.by_token(db, token)
    return _guest_view(req, await _slug(db, req["listing_id"]))


@router.post("/stays/requests/{token}/cancel", response_model=GuestStayView, summary="Cancel My Request")
@limiter.limit("20/minute")
async def cancel_my_stay(request: Request, token: str, db: AsyncSession = Depends(get_db_session, scope="function")) -> GuestStayView:
    req = await StayService.by_token(db, token)
    if req["check_in"] <= today():
        raise BadRequestException("The stay has started. Message us on WhatsApp to change it.")
    await StayService.move(db, req, "cancelled", actor="guest")
    return _guest_view(req, await _slug(db, req["listing_id"]))


@router.post("/stays/requests/{token}/report", response_model=GuestStayView, summary="Did You Stay?",
             description="The guest says whether the stay happened. From the check-in day.")
@limiter.limit("20/minute")
async def report_my_stay(request: Request, token: str, body: GuestReport, db: AsyncSession = Depends(get_db_session, scope="function")) -> GuestStayView:
    req = await StayService.by_token(db, token)
    await StayService.report(db, req, "guest", body.stayed)
    return _guest_view(req, await _slug(db, req["listing_id"]))


@router.post("/stays/concierge", response_model=ConciergeContactResult, status_code=status.HTTP_201_CREATED,
             summary="Chat With RumiaBnB",
             description="Records the contact with a reference code and returns a WhatsApp link to the RumiaBnB team. Public.")
@limiter.limit("20/minute")
async def concierge_contact(
    request: Request,
    data: ConciergeContactCreate,
    device_id: Optional[str] = Depends(get_device_id),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> ConciergeContactResult:
    ref, url, message = await StayService.concierge_contact(
        db, data.listing, data.attribution, device_id, user.id if user else None, data.session_id,
        data.check_in, data.check_out, data.guests,
    )
    return ConciergeContactResult(ref_code=ref, whatsapp_url=url, message=message)


# ── Hosts ───────────────────────────────────────────────────────────────────────────────────────────────────


@router.get("/orgs/{org_id}/stays", response_model=List[StayRow], summary="Booking Requests For My Places")
async def org_stays(org_id: str, status_filter: Optional[StayStatus] = Query(None, alias="status"),
                    access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> List[StayRow]:
    access.require("property.confirm", org_id=org_id)
    return [StayRow(**r) for r in await StayService.list_requests(db, org_ids=[org_id], status=status_filter)]


@router.get("/orgs/{org_id}/stays/summary", response_model=HostSummary, summary="What RumiaBnB Brought Me",
            description="Views, contacts by source, requests, completed stays and fees since a date (default: 90 days).")
async def org_stays_summary(org_id: str, since: Optional[date] = None, access: AccessContext = Depends(get_access),
                            db: AsyncSession = Depends(get_db_session, scope="function")) -> HostSummary:
    access.require("property.confirm", org_id=org_id)
    return HostSummary(**await StayService.summary(db, org_id, since or today() - timedelta(days=90)))


@router.get("/orgs/{org_id}/stays/{req_id}", response_model=StayDetail, summary="One Booking Request")
async def org_stay(org_id: str, req_id: str, access: AccessContext = Depends(get_access),
                   db: AsyncSession = Depends(get_db_session, scope="function")) -> StayDetail:
    access.require("property.confirm", org_id=org_id)
    return StayDetail(**await StayService.detail(db, req_id, org_id))


@router.post("/orgs/{org_id}/stays/{req_id}/confirm", response_model=StayDetail, summary="Confirm A Booking Request")
async def org_confirm(org_id: str, req_id: str, body: HostConfirm, access: AccessContext = Depends(get_access),
                      db: AsyncSession = Depends(get_db_session, scope="function")) -> StayDetail:
    access.require("property.confirm", org_id=org_id)
    req = await StayService.for_org(db, org_id, req_id)
    await StayService.move(db, req, "confirmed", actor="host", actor_user_id=access.user_id,
                           agreed_total=body.agreed_total, host_note=body.host_note)
    return StayDetail(**await StayService.detail(db, req_id, org_id))


@router.post("/orgs/{org_id}/stays/{req_id}/decline", response_model=StayDetail, summary="Decline A Booking Request")
async def org_decline(org_id: str, req_id: str, body: HostDecline, access: AccessContext = Depends(get_access),
                      db: AsyncSession = Depends(get_db_session, scope="function")) -> StayDetail:
    access.require("property.confirm", org_id=org_id)
    req = await StayService.for_org(db, org_id, req_id)
    await StayService.move(db, req, "declined", actor="host", actor_user_id=access.user_id, note=body.reason, host_note=body.reason)
    return StayDetail(**await StayService.detail(db, req_id, org_id))


@router.post("/orgs/{org_id}/stays/{req_id}/cancel", response_model=StayDetail, summary="Cancel A Confirmed Stay")
async def org_cancel(org_id: str, req_id: str, body: HostDecline, access: AccessContext = Depends(get_access),
                     db: AsyncSession = Depends(get_db_session, scope="function")) -> StayDetail:
    access.require("property.confirm", org_id=org_id)
    req = await StayService.for_org(db, org_id, req_id)
    await StayService.move(db, req, "cancelled", actor="host", actor_user_id=access.user_id, note=body.reason, host_note=body.reason)
    return StayDetail(**await StayService.detail(db, req_id, org_id))


@router.post("/orgs/{org_id}/stays/{req_id}/report", response_model=StayDetail, summary="Did The Guest Stay?",
             description="The host says whether the stay happened. A completed stay records the RumiaBnB fee.")
async def org_report(org_id: str, req_id: str, body: HostReport, access: AccessContext = Depends(get_access),
                     db: AsyncSession = Depends(get_db_session, scope="function")) -> StayDetail:
    access.require("property.confirm", org_id=org_id)
    req = await StayService.for_org(db, org_id, req_id)
    await StayService.report(db, req, "host", body.stayed, actor_user_id=access.user_id)
    return StayDetail(**await StayService.detail(db, req_id, org_id))


# ── Staff (concierge) ───────────────────────────────────────────────────────────────────────────────────────


@router.get("/ops/stays", response_model=List[StayRow], summary="All Booking Requests")
async def ops_stays(status_filter: Optional[StayStatus] = Query(None, alias="status"), access: AccessContext = Depends(get_access),
                    db: AsyncSession = Depends(get_db_session, scope="function")) -> List[StayRow]:
    _need_staff(access)
    return [StayRow(**r) for r in await StayService.list_requests(db, status=status_filter)]


@router.get("/ops/stays/contacts", response_model=List[ContactRow], summary="RumiaBnB Contacts",
            description="Recent contacts with their reference code and source, newest first.")
async def ops_contacts(access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> List[ContactRow]:
    _need_staff(access)
    return [ContactRow(**r) for r in await StayService.contacts(db)]


@router.get("/ops/stays/agreements", response_model=List[AgreementRead], summary="Host Fee Agreements")
async def ops_agreements(access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> List[AgreementRead]:
    _need_staff(access)
    return [AgreementRead(**a) for a in await StayService.agreements(db)]


@router.post("/ops/stays/agreements", response_model=AgreementRead, status_code=status.HTTP_201_CREATED, summary="Record A Host's Fee Terms")
async def ops_add_agreement(body: AgreementCreate, access: AccessContext = Depends(get_access),
                            db: AsyncSession = Depends(get_db_session, scope="function")) -> AgreementRead:
    _need_staff(access)
    return AgreementRead(**await StayService.add_agreement(
        db, body.org_id, body.fee_percent, body.fee_min, body.fee_night_cap, body.effective_from, body.note, access.user_id
    ))


@router.get("/ops/stays/hosts", response_model=List[HostAdminRow], summary="RumiaBnB Hosts",
            description="Every host with short stays: places, whether the owner has a login, fee terms, open requests.")
async def ops_hosts(access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> List[HostAdminRow]:
    _need_staff(access)
    return [HostAdminRow(**h) for h in await host_service.list_hosts(db)]


@router.post("/ops/stays/hosts/{org_id}/invite", response_model=InviteRead, status_code=status.HTTP_201_CREATED,
             summary="Invite A Host To Their Dashboard",
             description="A one-time link (14 days). Whoever opens it signed in becomes an owner of this host. Send it only to the owner.")
async def ops_invite(org_id: str, access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> InviteRead:
    _need_staff(access)
    return InviteRead(**await host_service.create_invite(db, org_id, access.user_id))


@router.post("/ops/stays", response_model=StayDetail, status_code=status.HTTP_201_CREATED, summary="Record A Concierge Booking",
             description="A stay arranged on WhatsApp, recorded for the guest. Pass the chat's reference code to keep its source.")
async def ops_create(body: OpsStayCreate, background_tasks: BackgroundTasks, access: AccessContext = Depends(get_access),
                     db: AsyncSession = Depends(get_db_session, scope="function")) -> StayDetail:
    _need_staff(access)
    from app.features.stays.schemas import Attribution

    created = await StayService.create_request(
        db, listing_ident=body.listing, check_in=body.check_in, check_out=body.check_out, guests=body.guests,
        guest_name=body.guest_name, guest_phone=body.guest_phone, guest_email=None, note=body.note,
        attribution=Attribution(), origin="concierge", staff_user_id=access.user_id, ref_code=body.ref_code,
    )
    if not created["duplicate"]:
        await _notify_hosts(background_tasks, db, created, body.guest_name.strip())
    return StayDetail(**await StayService.detail(db, created["id"]))


@router.get("/ops/stays/{req_id}", response_model=StayDetail, summary="One Booking Request (Staff)")
async def ops_stay(req_id: str, access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> StayDetail:
    _need_staff(access)
    return StayDetail(**await StayService.detail(db, req_id))


@router.post("/ops/stays/{req_id}/status", response_model=StayDetail, summary="Change A Request's Status",
             description="Staff may make any reasonable change (including resolving disputes); the reason is kept in the history.")
async def ops_status(req_id: str, body: OpsStatusChange, access: AccessContext = Depends(get_access),
                     db: AsyncSession = Depends(get_db_session, scope="function")) -> StayDetail:
    _need_staff(access)
    req = await StayService.by_id(db, req_id)
    await StayService.move(db, req, body.to_status, actor="staff", actor_user_id=access.user_id, note=body.note,
                           agreed_total=body.agreed_total)
    return StayDetail(**await StayService.detail(db, req_id))


# ── Host accounts ───────────────────────────────────────────────────────────────────────────────────────────


@router.get("/me/host-orgs", response_model=List[HostOrg], summary="My RumiaBnB Hosts",
            description="The organisations the signed-in person manages on RumiaBnB, with their places.")
async def my_host_orgs(user: AuthenticatedUser = Depends(get_current_user), db: AsyncSession = Depends(get_db_session, scope="function")) -> List[HostOrg]:
    return [HostOrg(**o) for o in await host_service.my_host_orgs(db, user.id)]


@router.post("/host/claim", response_model=ClaimResult, summary="Accept A Host Invite")
@limiter.limit("10/minute")
async def claim_host(request: Request, body: ClaimBody, user: AuthenticatedUser = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db_session, scope="function")) -> ClaimResult:
    return ClaimResult(**await host_service.claim(db, body.token, user.id))
