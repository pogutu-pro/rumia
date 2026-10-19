"""RumiaBnB stays: contacts with attribution, booking requests, their lifecycle, and the stay fee.

Every contact a guest makes through RumiaBnB is an `inquiries` row (product 'bnb') with a reference code and the
campaign that brought them. A booking request adds a `stay_requests` row. A stay is completed when the guest or the host
says it happened (both are trusted while hosts and guests are few); conflicting reports become a dispute for staff.
Only a completed stay creates a fee, at most one per stay.
"""
import hashlib
import logging
import re
import secrets
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote as urlquote
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.device import touch_device
from app.core.errors import BadRequestException, ConflictException, NotFoundException
from app.features.bnb.models import BnbDetails
from app.features.hostel_requests.service import clean_kenyan_phone
from app.features.inquiries.service import new_ref_code
from app.features.listings.models import Listing
from app.features.stays.pricing import FeeTerms, Quote, quote_stay, stay_fee
from app.features.stays.schemas import Attribution

logger = logging.getLogger(__name__)

NAIROBI = ZoneInfo("Africa/Nairobi")
MAX_NIGHTS = 365
OPEN = ("requested", "confirmed")

# Who may move a request from one status to another by hand. Reports (stayed / did not stay) are separate.
GUEST_MOVES = {("requested", "cancelled"), ("confirmed", "cancelled")}
HOST_MOVES = {("requested", "confirmed"), ("requested", "declined"), ("confirmed", "cancelled")}
STAFF_MOVES = HOST_MOVES | GUEST_MOVES | {
    ("confirmed", "completed"), ("confirmed", "no_show"),
    ("disputed", "completed"), ("disputed", "no_show"),
    ("completed", "no_show"), ("no_show", "completed"),
    ("declined", "requested"), ("cancelled", "requested"),
}


def today() -> date:
    return datetime.now(NAIROBI).date()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def clean_guest_phone(value: str) -> str:
    """Kenyan numbers to +254…; other countries accepted in international form (+<country><number>)."""
    raw = (value or "").strip()
    digits = re.sub(r"\D", "", raw)
    if raw.startswith("+") and not digits.startswith("254"):
        if 8 <= len(digits) <= 15:
            return f"+{digits}"
        raise BadRequestException("Please enter your phone number with its country code, e.g. +44 7700 900123.")
    return clean_kenyan_phone(raw)


def _clip(value: Optional[str], n: int) -> Optional[str]:
    value = (value or "").strip()
    return value[:n] or None


def decide_outcome(guest_report: Optional[str], host_report: Optional[str]) -> Optional[str]:
    """What the reports say about a confirmed stay: completed, no_show, disputed, or None (nobody has reported)."""
    reports = {r for r in (guest_report, host_report) if r}
    if not reports:
        return None
    if reports == {"stayed", "did_not_stay"}:
        return "disputed"
    return "completed" if "stayed" in reports else "no_show"


class StayService:
    # ── Listings and prices ──────────────────────────────────────────────────────────────────────────────────

    @staticmethod
    async def resolve_listing(db: AsyncSession, ident: str) -> Tuple[Listing, Optional[BnbDetails]]:
        """An active short stay by id or slug."""
        ident = (ident or "").strip()
        is_uuid = bool(re.fullmatch(r"[0-9a-fA-F-]{36}", ident))
        stmt = select(Listing).where(Listing.id == ident) if is_uuid else select(Listing).where(Listing.slug == ident)
        listing = (await db.execute(stmt)).scalar_one_or_none()
        if not listing or not listing.is_active or listing.property_type != "short_stay":
            raise NotFoundException("This stay is no longer listed.")
        bnb = (await db.execute(select(BnbDetails).where(BnbDetails.listing_id == listing.id))).scalar_one_or_none()
        return listing, bnb

    @staticmethod
    def quote(listing: Listing, bnb: Optional[BnbDetails], check_in: date, check_out: date) -> Quote:
        def dec(v) -> Optional[Decimal]:
            return Decimal(str(v)) if v not in (None, 0) else None

        return quote_stay(
            check_in, check_out, Decimal(str(listing.price)),
            weekly=dec(getattr(bnb, "weekly_price", None)), monthly=dec(getattr(bnb, "monthly_price", None)),
            cleaning_fee=dec(getattr(bnb, "cleaning_fee", None)),
        )

    @staticmethod
    def check_dates(listing: Listing, bnb: Optional[BnbDetails], check_in: date, check_out: date, guests: int, *, allow_past: bool = False) -> None:
        nights = (check_out - check_in).days
        if nights < 1:
            raise BadRequestException("Check-out must be after check-in.")
        if nights > MAX_NIGHTS:
            raise BadRequestException("Stays can be at most a year. Ask us on WhatsApp for longer.")
        if not allow_past and check_in < today():
            raise BadRequestException("Check-in cannot be in the past.")
        if bnb is None:
            return
        if bnb.max_guests and guests > bnb.max_guests:
            raise BadRequestException(f"This place takes up to {bnb.max_guests} guests.")
        if bnb.min_stay_nights and nights < bnb.min_stay_nights:
            raise BadRequestException(f"The minimum stay here is {bnb.min_stay_nights} nights.")
        if bnb.max_stay_nights and nights > bnb.max_stay_nights:
            raise BadRequestException(f"The longest stay here is {bnb.max_stay_nights} nights.")
        if bnb.available_from and check_in < bnb.available_from:
            raise BadRequestException(f"This place is available from {bnb.available_from:%d %b %Y}.")
        if bnb.available_until and check_out > bnb.available_until:
            raise BadRequestException(f"This place is available until {bnb.available_until:%d %b %Y}.")

    @staticmethod
    async def org_for_listing(db: AsyncSession, listing: Listing) -> Optional[str]:
        row = (
            await db.execute(
                text(
                    """
                    SELECT coalesce(
                      (SELECT org_id FROM properties WHERE legacy_listing_id = CAST(:l AS uuid)),
                      (SELECT id FROM lister_orgs WHERE legacy_agent_id = CAST(:a AS uuid)))
                    """
                ),
                {"l": str(listing.id), "a": str(listing.agent_id)},
            )
        ).first()
        return str(row[0]) if row and row[0] else None

    @staticmethod
    async def host_user_ids(db: AsyncSession, org_id: Optional[str], listing: Optional[Listing]) -> List[str]:
        """Who to notify about a request: the organisation's owners and managers, and the listing's agent."""
        rows = (
            await db.execute(
                text(
                    """
                    SELECT user_id FROM org_members WHERE org_id = CAST(:o AS uuid) AND role IN ('owner', 'manager')
                    UNION SELECT user_id FROM agents WHERE id = CAST(:a AS uuid) AND user_id IS NOT NULL
                    """
                ),
                {"o": org_id, "a": str(listing.agent_id) if listing else None},
            )
        ).all()
        return [str(r[0]) for r in rows if r[0]]

    # ── Contacts ─────────────────────────────────────────────────────────────────────────────────────────────

    @staticmethod
    async def create_contact(
        db: AsyncSession,
        *,
        listing: Optional[Listing],
        channel: str,
        handled_by: str,
        attribution: Attribution,
        device_id: Optional[str],
        user_id: Optional[str],
        session_id: Optional[str],
        source: str,
    ) -> Tuple[str, str]:
        """Insert a RumiaBnB contact with a fresh reference code. Returns (inquiry id, ref code)."""
        a = attribution
        for _ in range(8):
            ref_code = new_ref_code()
            try:
                async with db.begin_nested():
                    row = await db.execute(
                        text(
                            """
                            INSERT INTO inquiries (ref_code, listing_id, agent_id, channel, device_id, user_id, session_id, source,
                                                   product, handled_by, utm_source, utm_medium, utm_campaign, utm_content,
                                                   landing_path, heard_from)
                            VALUES (:ref, CAST(:l AS uuid), CAST(:a AS uuid), :ch, CAST(:d AS uuid), CAST(:u AS uuid), :s, :src,
                                    'bnb', :hb, :us, :um, :uc, :ut, :lp, :hf)
                            RETURNING id
                            """
                        ),
                        {
                            "ref": ref_code,
                            "l": str(listing.id) if listing else None,
                            "a": str(listing.agent_id) if listing and listing.agent_id else None,
                            "ch": channel, "d": device_id, "u": user_id, "s": session_id, "src": source, "hb": handled_by,
                            "us": _clip(a.utm_source, 100), "um": _clip(a.utm_medium, 100), "uc": _clip(a.utm_campaign, 100),
                            "ut": _clip(a.utm_content, 100), "lp": _clip(a.landing_path, 300), "hf": _clip(a.heard_from, 60),
                        },
                    )
                    inquiry_id = str(row.scalar_one())
                if device_id:
                    await touch_device(db, device_id, user_id)
                return inquiry_id, ref_code
            except IntegrityError:
                continue
        raise ConflictException(code="REF_UNAVAILABLE", message="Please try again.")

    @staticmethod
    async def concierge_contact(
        db: AsyncSession, listing_ident: Optional[str], attribution: Attribution, device_id: Optional[str],
        user_id: Optional[str], session_id: Optional[str],
    ) -> Tuple[str, str, str]:
        """A chat with the RumiaBnB concierge. Returns (ref code, WhatsApp URL, message)."""
        number = re.sub(r"\D", "", settings.BNB_CONCIERGE_WHATSAPP or "")
        if not number:
            raise ConflictException(code="NO_CONCIERGE", message="Chat is not available right now. Send a booking request instead.")
        listing = None
        if listing_ident:
            listing, _ = await StayService.resolve_listing(db, listing_ident)
        _, ref_code = await StayService.create_contact(
            db, listing=listing, channel="whatsapp", handled_by="concierge", attribution=attribution,
            device_id=device_id, user_id=user_id, session_id=session_id, source="concierge",
        )
        about = f"*{listing.title}*" if listing else "a place to stay"
        message = f"Hi RumiaBnB, I'm asking about {about}. My dates are: … Ref {ref_code}"
        return ref_code, f"https://wa.me/{number}?text={urlquote(message)}", message

    # ── Requests ─────────────────────────────────────────────────────────────────────────────────────────────

    @staticmethod
    async def _event(db: AsyncSession, req_id: str, actor: str, action: str, from_status: Optional[str] = None,
                     to_status: Optional[str] = None, note: Optional[str] = None, actor_user_id: Optional[str] = None) -> None:
        await db.execute(
            text(
                """
                INSERT INTO stay_request_events (stay_request_id, actor, actor_user_id, action, from_status, to_status, note)
                VALUES (CAST(:r AS uuid), :a, CAST(:u AS uuid), :act, :f, :t, :n)
                """
            ),
            {"r": req_id, "a": actor, "u": actor_user_id, "act": action, "f": from_status, "t": to_status, "n": note},
        )

    @staticmethod
    async def create_request(
        db: AsyncSession,
        *,
        listing_ident: str,
        check_in: date,
        check_out: date,
        guests: int,
        guest_name: str,
        guest_phone: str,
        guest_email: Optional[str],
        note: Optional[str],
        attribution: Attribution,
        origin: str,
        device_id: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        staff_user_id: Optional[str] = None,
        ref_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record a booking request. Returns {id, ref_code, token, status, listing, quote, org_id, duplicate}.

        A second request from the same phone for the same place and overlapping dates returns the open one (with a
        new status-page token) instead of creating a duplicate that could be attributed twice.
        """
        listing, bnb = await StayService.resolve_listing(db, listing_ident)
        StayService.check_dates(listing, bnb, check_in, check_out, guests, allow_past=origin == "concierge")
        phone = clean_guest_phone(guest_phone)
        q = StayService.quote(listing, bnb, check_in, check_out)
        org_id = await StayService.org_for_listing(db, listing)
        token = secrets.token_urlsafe(24)

        existing = (
            await db.execute(
                text(
                    """
                    SELECT r.id, r.status, i.ref_code FROM stay_requests r LEFT JOIN inquiries i ON i.id = r.inquiry_id
                    WHERE r.listing_id = CAST(:l AS uuid) AND r.guest_phone = :p AND r.status IN ('requested', 'confirmed')
                      AND r.check_in < :co AND r.check_out > :ci
                    ORDER BY r.created_at LIMIT 1 FOR UPDATE OF r
                    """
                ),
                {"l": str(listing.id), "p": phone, "ci": check_in, "co": check_out},
            )
        ).first()
        if existing:
            await db.execute(
                text("UPDATE stay_requests SET access_token_hash = :h, updated_at = now() WHERE id = :id"),
                {"h": hash_token(token), "id": existing[0]},
            )
            await StayService._event(db, str(existing[0]), "guest" if origin == "guest" else "staff", "repeated",
                                     note="Same guest asked again; status link reissued", actor_user_id=staff_user_id)
            return {"id": str(existing[0]), "ref_code": existing[2], "token": token, "status": existing[1], "listing": listing,
                    "quote": q, "org_id": org_id, "duplicate": True}

        inquiry_id = None
        if ref_code:
            row = (
                await db.execute(
                    text("SELECT id FROM inquiries WHERE ref_code = :r AND product = 'bnb'"), {"r": ref_code.strip().upper()}
                )
            ).first()
            if not row:
                raise NotFoundException("No RumiaBnB contact has that reference code.")
            if (await db.execute(text("SELECT 1 FROM stay_requests WHERE inquiry_id = :i"), {"i": row[0]})).first():
                raise ConflictException(code="REF_USED", message="That reference code already has a booking.")
            inquiry_id = str(row[0])
            # The chat may have started before a place was chosen: attach it now.
            await db.execute(
                text("UPDATE inquiries SET listing_id = coalesce(listing_id, CAST(:l AS uuid)), agent_id = coalesce(agent_id, CAST(:a AS uuid)) WHERE id = :i"),
                {"l": str(listing.id), "a": str(listing.agent_id), "i": inquiry_id},
            )
            ref = ref_code.strip().upper()
        else:
            inquiry_id, ref = await StayService.create_contact(
                db, listing=listing, channel="request" if origin == "guest" else "whatsapp",
                handled_by="host" if origin == "guest" else "concierge", attribution=attribution,
                device_id=device_id, user_id=user_id, session_id=session_id, source="request" if origin == "guest" else "concierge",
            )

        row = await db.execute(
            text(
                """
                INSERT INTO stay_requests (inquiry_id, listing_id, org_id, listing_title, origin, guest_name, guest_phone, guest_email,
                                           guests, check_in, check_out, rate_basis, quoted_total, cleaning_fee, guest_note,
                                           access_token_hash, created_by)
                VALUES (CAST(:i AS uuid), CAST(:l AS uuid), CAST(:o AS uuid), :t, :origin, :n, :p, :e, :g, :ci, :co, :rb, :qt, :cf, :note,
                        :h, CAST(:by AS uuid))
                RETURNING id
                """
            ),
            {
                "i": inquiry_id, "l": str(listing.id), "o": org_id, "t": listing.title, "origin": origin,
                "n": guest_name.strip(), "p": phone, "e": _clip(guest_email, 120), "g": guests, "ci": check_in, "co": check_out,
                "rb": q.rate_basis, "qt": q.room_total, "cf": q.cleaning_fee, "note": _clip(note, 1000), "h": hash_token(token),
                "by": staff_user_id,
            },
        )
        req_id = str(row.scalar_one())
        await StayService._event(db, req_id, "guest" if origin == "guest" else "staff", "created", to_status="requested",
                                 actor_user_id=staff_user_id)
        return {"id": req_id, "ref_code": ref, "token": token, "status": "requested", "listing": listing, "quote": q,
                "org_id": org_id, "duplicate": False}

    @staticmethod
    async def _load(db: AsyncSession, where: str, params: Dict[str, Any]) -> Dict[str, Any]:
        row = (
            await db.execute(
                text(f"SELECT r.*, i.ref_code FROM stay_requests r LEFT JOIN inquiries i ON i.id = r.inquiry_id WHERE {where} FOR UPDATE OF r"),
                params,
            )
        ).mappings().first()
        if not row:
            raise NotFoundException("Booking request not found.")
        req = dict(row)
        for k in ("id", "inquiry_id", "listing_id", "org_id"):
            req[k] = str(req[k]) if req.get(k) else None
        return req

    @staticmethod
    async def by_token(db: AsyncSession, token: str) -> Dict[str, Any]:
        return await StayService._load(db, "r.access_token_hash = :h", {"h": hash_token(token)})

    @staticmethod
    async def for_org(db: AsyncSession, org_id: str, req_id: str) -> Dict[str, Any]:
        return await StayService._load(db, "r.id = CAST(:id AS uuid) AND r.org_id = CAST(:o AS uuid)", {"id": req_id, "o": org_id})

    @staticmethod
    async def by_id(db: AsyncSession, req_id: str) -> Dict[str, Any]:
        return await StayService._load(db, "r.id = CAST(:id AS uuid)", {"id": req_id})

    @staticmethod
    async def move(
        db: AsyncSession, req: Dict[str, Any], to_status: str, *, actor: str, actor_user_id: Optional[str] = None,
        note: Optional[str] = None, agreed_total: Optional[float] = None, host_note: Optional[str] = None,
    ) -> str:
        allowed = {"guest": GUEST_MOVES, "host": HOST_MOVES, "staff": STAFF_MOVES}[actor]
        current = req["status"]
        if current == to_status and agreed_total is None:
            return current
        if (current, to_status) not in allowed and current != to_status:
            raise ConflictException(code="BAD_TRANSITION", message=f"A {current.replace('_', ' ')} request cannot become {to_status.replace('_', ' ')}.")
        sets = ["status = :s", "updated_at = now()"]
        params: Dict[str, Any] = {"s": to_status, "id": req["id"]}
        if to_status == "confirmed" and current != "confirmed":
            sets.append("confirmed_at = now()")
        if to_status in ("declined", "cancelled", "completed", "no_show"):
            sets.append("closed_at = now()")
        if agreed_total is not None:
            sets.append("agreed_total = :at")
            params["at"] = agreed_total
        if host_note is not None:
            sets.append("host_note = :hn")
            params["hn"] = _clip(host_note, 500)
        await db.execute(text(f"UPDATE stay_requests SET {', '.join(sets)} WHERE id = :id"), params)
        await StayService._event(db, str(req["id"]), actor, "status", current, to_status, note, actor_user_id)
        req.update(status=to_status, agreed_total=agreed_total if agreed_total is not None else req.get("agreed_total"))
        await StayService._settle_fee(db, req)
        return to_status

    @staticmethod
    async def report(db: AsyncSession, req: Dict[str, Any], who: str, stayed: bool, actor_user_id: Optional[str] = None) -> str:
        """The guest or the host says whether the stay happened; the status follows the reports."""
        if req["status"] not in ("confirmed", "completed", "no_show", "disputed"):
            raise ConflictException(code="NOT_CONFIRMED", message="Only a confirmed stay can be reported.")
        if req["check_in"] > today():
            raise ConflictException(code="TOO_EARLY", message="You can report the stay from the check-in day.")
        value = "stayed" if stayed else "did_not_stay"
        col = "guest_report" if who == "guest" else "host_report"
        await db.execute(
            text(f"UPDATE stay_requests SET {col} = :v, {who}_reported_at = now(), updated_at = now() WHERE id = :id"),
            {"v": value, "id": req["id"]},
        )
        await StayService._event(db, str(req["id"]), who, "report", note=value, actor_user_id=actor_user_id)
        req[col] = value
        if req["status"] == "disputed":
            return "disputed"  # staff decide
        outcome = decide_outcome(req.get("guest_report"), req.get("host_report"))
        if outcome and outcome != req["status"]:
            previous = req["status"]
            await db.execute(
                text("UPDATE stay_requests SET status = :s, closed_at = CASE WHEN :s = 'disputed' THEN closed_at ELSE now() END, updated_at = now() WHERE id = :id"),
                {"s": outcome, "id": req["id"]},
            )
            await StayService._event(db, str(req["id"]), "system", "status", previous, outcome, f"after {who} report")
            req["status"] = outcome
            await StayService._settle_fee(db, req)
        return req["status"]

    # ── Fees ─────────────────────────────────────────────────────────────────────────────────────────────────

    @staticmethod
    async def terms_for(db: AsyncSession, org_id: Optional[str], on: date) -> FeeTerms:
        row = None
        if org_id:
            row = (
                await db.execute(
                    text(
                        """
                        SELECT fee_percent, fee_min, fee_night_cap FROM host_agreements
                        WHERE org_id = CAST(:o AS uuid) AND effective_from <= :d AND (effective_to IS NULL OR effective_to >= :d)
                        ORDER BY effective_from DESC, created_at DESC LIMIT 1
                        """
                    ),
                    {"o": org_id, "d": on},
                )
            ).first()
        if row:
            return FeeTerms(Decimal(str(row[0])), Decimal(str(row[1])), row[2])
        return FeeTerms(Decimal(str(settings.BNB_FEE_PERCENT)), Decimal(str(settings.BNB_FEE_MIN_KES)), settings.BNB_FEE_NIGHT_CAP or None)

    @staticmethod
    async def _settle_fee(db: AsyncSession, req: Dict[str, Any]) -> None:
        """A completed stay has one pending fee; any other status voids an unpaid one."""
        if req["status"] == "completed":
            room_total = Decimal(str(req["agreed_total"] if req.get("agreed_total") is not None else req["quoted_total"]))
            terms = await StayService.terms_for(db, str(req["org_id"]) if req.get("org_id") else None, req["check_in"])
            amount = stay_fee(room_total, int(req["nights"]), terms)
            await db.execute(
                text(
                    """
                    INSERT INTO ledger_entries (kind, org_id, amount, inquiry_id, stay_request_id, property_id, note)
                    VALUES ('stay_fee', CAST(:o AS uuid), :amt, CAST(:i AS uuid), CAST(:r AS uuid),
                            (SELECT id FROM properties WHERE legacy_listing_id = CAST(:l AS uuid)), :note)
                    ON CONFLICT (stay_request_id) WHERE kind = 'stay_fee'
                    DO UPDATE SET amount = EXCLUDED.amount, status = 'pending', note = EXCLUDED.note
                    WHERE ledger_entries.status IN ('pending', 'void')
                    """
                ),
                {
                    "o": str(req["org_id"]) if req.get("org_id") else None, "amt": amount,
                    "i": str(req["inquiry_id"]) if req.get("inquiry_id") else None, "r": str(req["id"]),
                    "l": str(req["listing_id"]) if req.get("listing_id") else None,
                    "note": f"{terms.percent}% of KES {room_total:,.0f} ({req['nights']} nights), min KES {terms.minimum:,.0f}",
                },
            )
        else:
            await db.execute(
                text("UPDATE ledger_entries SET status = 'void' WHERE stay_request_id = CAST(:r AS uuid) AND kind = 'stay_fee' AND status = 'pending'"),
                {"r": str(req["id"])},
            )

    # ── Lists and reports ────────────────────────────────────────────────────────────────────────────────────

    ROW_SELECT = """
        SELECT r.id, i.ref_code, r.status, r.origin, r.listing_id, r.listing_title, l.slug AS listing_slug, r.org_id,
               r.guest_name, r.guest_phone, r.guest_email, r.guests, r.check_in, r.check_out, r.nights, r.rate_basis,
               r.quoted_total, r.agreed_total, r.cleaning_fee, r.guest_note, r.host_note, r.guest_report, r.host_report,
               coalesce(i.utm_source, i.heard_from) AS source, i.utm_campaign,
               le.amount AS fee_amount, le.status AS fee_status, r.created_at
        FROM stay_requests r
        LEFT JOIN inquiries i ON i.id = r.inquiry_id
        LEFT JOIN listings l ON l.id = r.listing_id
        LEFT JOIN ledger_entries le ON le.stay_request_id = r.id AND le.kind = 'stay_fee'
    """

    @staticmethod
    def _row(r) -> Dict[str, Any]:
        d = dict(r)
        for k in ("id", "listing_id", "org_id"):
            d[k] = str(d[k]) if d.get(k) else None
        for k in ("quoted_total", "agreed_total", "cleaning_fee", "fee_amount"):
            d[k] = float(d[k]) if d.get(k) is not None else None
        return d

    @staticmethod
    async def list_requests(db: AsyncSession, *, org_ids: Optional[List[str]] = None, status: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
        where, params = ["true"], {"lim": limit}
        if org_ids is not None:
            where.append("r.org_id = ANY(CAST(:o AS uuid[]))")
            params["o"] = org_ids
        if status:
            where.append("r.status = :s")
            params["s"] = status
        rows = (
            await db.execute(
                text(StayService.ROW_SELECT + f" WHERE {' AND '.join(where)} ORDER BY (r.status IN ('requested','disputed')) DESC, r.check_in, r.created_at DESC LIMIT :lim"),
                params,
            )
        ).mappings().all()
        return [StayService._row(r) for r in rows]

    @staticmethod
    async def detail(db: AsyncSession, req_id: str, org_id: Optional[str] = None) -> Dict[str, Any]:
        where = "r.id = CAST(:id AS uuid)" + (" AND r.org_id = CAST(:o AS uuid)" if org_id else "")
        row = (await db.execute(text(StayService.ROW_SELECT + f" WHERE {where}"), {"id": req_id, "o": org_id})).mappings().first()
        if not row:
            raise NotFoundException("Booking request not found.")
        events = (
            await db.execute(
                text("SELECT at, actor, action, from_status, to_status, note FROM stay_request_events WHERE stay_request_id = CAST(:id AS uuid) ORDER BY at"),
                {"id": req_id},
            )
        ).mappings().all()
        return {**StayService._row(row), "events": [dict(e) for e in events]}

    @staticmethod
    async def contacts(db: AsyncSession, limit: int = 200) -> List[Dict[str, Any]]:
        rows = (
            await db.execute(
                text(
                    """
                    SELECT i.ref_code, i.channel, i.handled_by, l.title AS listing_title, coalesce(i.utm_source, i.heard_from) AS source,
                           i.utm_campaign, i.landing_path, i.created_at,
                           EXISTS (SELECT 1 FROM stay_requests r WHERE r.inquiry_id = i.id) AS has_request
                    FROM inquiries i LEFT JOIN listings l ON l.id = i.listing_id
                    WHERE i.product = 'bnb' ORDER BY i.created_at DESC LIMIT :lim
                    """
                ),
                {"lim": limit},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    @staticmethod
    async def summary(db: AsyncSession, org_id: str, since: date) -> Dict[str, Any]:
        """Views, contacts, requests, stays and fees for one organisation's RumiaBnB places since a date."""
        params = {"o": org_id, "since": since}
        listings_cte = """
            WITH ls AS (
              SELECT l.id FROM listings l
              WHERE l.property_type = 'short_stay' AND (
                l.id IN (SELECT legacy_listing_id FROM properties WHERE org_id = CAST(:o AS uuid))
                OR l.agent_id IN (SELECT legacy_agent_id FROM lister_orgs WHERE id = CAST(:o AS uuid))))
        """
        views = (
            await db.execute(
                text(listings_cte + " SELECT count(*) FROM events e WHERE e.name = 'property_opened' AND e.listing_id IN (SELECT id FROM ls) AND e.occurred_at >= :since"),
                params,
            )
        ).scalar_one()
        counts = (
            await db.execute(
                text(
                    listings_cte
                    + """
                    SELECT
                      (SELECT count(*) FROM inquiries WHERE product = 'bnb' AND listing_id IN (SELECT id FROM ls) AND created_at >= :since) AS contacts,
                      count(*) AS requests,
                      count(*) FILTER (WHERE r.status IN ('confirmed', 'completed', 'no_show', 'disputed')) AS confirmed,
                      count(*) FILTER (WHERE r.status = 'completed') AS completed,
                      coalesce(sum(coalesce(r.agreed_total, r.quoted_total)) FILTER (WHERE r.status = 'completed'), 0) AS room_value
                    FROM stay_requests r WHERE r.org_id = CAST(:o AS uuid) AND r.created_at >= :since
                    """
                ),
                params,
            )
        ).mappings().one()
        fees = (
            await db.execute(
                text(
                    """
                    SELECT coalesce(sum(amount) FILTER (WHERE status IN ('pending', 'approved')), 0) AS pending,
                           coalesce(sum(amount) FILTER (WHERE status = 'paid'), 0) AS paid
                    FROM ledger_entries WHERE kind = 'stay_fee' AND org_id = CAST(:o AS uuid) AND created_at >= :since
                    """
                ),
                params,
            )
        ).mappings().one()
        by_source = (
            await db.execute(
                text(
                    listings_cte
                    + """
                    SELECT coalesce(nullif(lower(coalesce(i.utm_source, i.heard_from)), ''), 'unknown') AS source,
                           count(*) AS contacts,
                           count(r.id) AS requests,
                           count(r.id) FILTER (WHERE r.status = 'completed') AS completed
                    FROM inquiries i LEFT JOIN stay_requests r ON r.inquiry_id = i.id
                    WHERE i.product = 'bnb' AND i.listing_id IN (SELECT id FROM ls) AND i.created_at >= :since
                    GROUP BY 1 ORDER BY 2 DESC
                    """
                ),
                params,
            )
        ).mappings().all()
        return {
            "since": since, "views": int(views), "contacts": int(counts["contacts"]), "requests": int(counts["requests"]),
            "confirmed": int(counts["confirmed"]), "completed": int(counts["completed"]),
            "room_value_completed": float(counts["room_value"]), "fees_pending": float(fees["pending"]), "fees_paid": float(fees["paid"]),
            "by_source": [dict(s) for s in by_source],
        }

    # ── Agreements ───────────────────────────────────────────────────────────────────────────────────────────

    @staticmethod
    async def add_agreement(db: AsyncSession, org_id: str, fee_percent: float, fee_min: float, fee_night_cap: Optional[int],
                            effective_from: Optional[date], note: Optional[str], created_by: str) -> Dict[str, Any]:
        """New terms for a host. The previous open agreement ends the day before the new one starts."""
        start = effective_from or today()
        if not (await db.execute(text("SELECT 1 FROM lister_orgs WHERE id = CAST(:o AS uuid)"), {"o": org_id})).first():
            raise NotFoundException("Host organisation not found.")
        await db.execute(
            text(
                """
                UPDATE host_agreements SET effective_to = CAST(:d AS date) - 1
                WHERE org_id = CAST(:o AS uuid) AND effective_to IS NULL AND effective_from < :d
                """
            ),
            {"o": org_id, "d": start},
        )
        row = (
            await db.execute(
                text(
                    """
                    INSERT INTO host_agreements (org_id, fee_percent, fee_min, fee_night_cap, effective_from, note, created_by)
                    VALUES (CAST(:o AS uuid), :p, :m, :c, :d, :n, CAST(:by AS uuid))
                    RETURNING id, org_id, fee_percent, fee_min, fee_night_cap, effective_from, effective_to, note, created_at
                    """
                ),
                {"o": org_id, "p": fee_percent, "m": fee_min, "c": fee_night_cap, "d": start, "n": _clip(note, 500), "by": created_by},
            )
        ).mappings().one()
        return StayService._agreement(row)

    @staticmethod
    def _agreement(r) -> Dict[str, Any]:
        d = dict(r)
        d["id"], d["org_id"] = str(d["id"]), str(d["org_id"])
        d["fee_percent"], d["fee_min"] = float(d["fee_percent"]), float(d["fee_min"])
        return d

    @staticmethod
    async def agreements(db: AsyncSession) -> List[Dict[str, Any]]:
        rows = (
            await db.execute(
                text(
                    """
                    SELECT a.id, a.org_id, o.name AS org_name, a.fee_percent, a.fee_min, a.fee_night_cap, a.effective_from,
                           a.effective_to, a.note, a.created_at
                    FROM host_agreements a JOIN lister_orgs o ON o.id = a.org_id
                    ORDER BY o.name, a.effective_from DESC
                    """
                )
            )
        ).mappings().all()
        return [StayService._agreement(r) for r in rows]
