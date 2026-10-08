import logging
import re
import secrets
from typing import Optional, Tuple
from urllib.parse import quote

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.device import touch_device
from app.core.errors import BadRequestException, ConflictException, NotFoundException
from app.features.hostel_requests.service import clean_kenyan_phone
from app.features.inquiries.schemas import InquiryCreate, InquiryResult
from app.features.listings.models import Agent, Listing
from sqlalchemy import select

logger = logging.getLogger(__name__)

# 32 symbols without look-alikes (no 0/O, 1/I) so a code survives being read out or typed.
REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
REF_LENGTH = 5


def new_ref_code() -> str:
    return "".join(secrets.choice(REF_ALPHABET) for _ in range(REF_LENGTH))


def _digits_for_wa(number: str) -> str:
    """E.164 digits without '+' (what wa.me expects). Falls back to the raw digits for odd numbers."""
    try:
        return clean_kenyan_phone(number).lstrip("+")
    except BadRequestException:
        return re.sub(r"\D", "", number or "")


def _tel(number: str) -> str:
    digits = _digits_for_wa(number)
    return f"tel:+{digits}" if digits else ""


def pick_contact(listing, agent, policy: str) -> Tuple[str, str]:
    """(display name, phone number) a seeker should reach for this listing."""
    owner = (getattr(listing, "landlord_phone", None) or "").strip()
    agent_number = ((getattr(agent, "whatsapp", None) or getattr(agent, "phone", None)) or "").strip()
    agent_name = (getattr(agent, "name", None) or "the owner").strip()
    if policy == "owner_first" and owner:
        return "the owner", owner
    if agent_number:
        return agent_name, agent_number
    if owner:
        return "the owner", owner
    raise ConflictException(code="NO_CONTACT", message="This place has no contact number yet.")


def build_message(title: str, price: float, period: str, ref_code: str) -> str:
    return (
        f"Hi, I found *{title}* on Rumia (KSh {int(round(float(price))):,}{period}). "
        f"Is it still available? Ref {ref_code}"
    )


class InquiryService:
    @staticmethod
    async def create(
        db: AsyncSession,
        data: InquiryCreate,
        device_id: Optional[str],
        user_id: Optional[str],
        ip_hash: str,
    ) -> Tuple[InquiryResult, Optional[str], str]:
        """Record a contact and return what the client needs to open the chat.

        Returns (result, agent_user_id_to_notify, listing_title). Never requires an account.
        """
        res = await db.execute(select(Listing).where(Listing.id == data.listing_id))
        listing = res.scalar_one_or_none()
        if not listing or not listing.is_active:
            raise NotFoundException("This place is no longer listed.")
        agent = (await db.execute(select(Agent).where(Agent.id == listing.agent_id))).scalar_one_or_none()

        name, number = pick_contact(listing, agent, settings.INQUIRY_CONTACT_POLICY)
        period = "/night" if listing.property_type == "short_stay" else "/month"

        ref_code = ""
        for _ in range(8):  # collisions are astronomically unlikely, but never fail a contact over one
            ref_code = new_ref_code()
            try:
                async with db.begin_nested():
                    await db.execute(
                        text(
                            """
                            INSERT INTO inquiries (ref_code, listing_id, agent_id, channel, device_id, user_id, session_id, source)
                            VALUES (:ref, CAST(:l AS uuid), CAST(:a AS uuid), :ch, CAST(:d AS uuid), CAST(:u AS uuid), :s, :src)
                            """
                        ),
                        {
                            "ref": ref_code, "l": str(listing.id), "a": str(listing.agent_id) if listing.agent_id else None,
                            "ch": data.channel, "d": device_id, "u": user_id, "s": data.session_id, "src": data.source,
                        },
                    )
                break
            except IntegrityError:
                ref_code = ""
        if not ref_code:
            raise ConflictException(code="REF_UNAVAILABLE", message="Please try again.")

        if device_id:
            await touch_device(db, device_id, user_id)

        # Legacy per-click commission, kept only until the revenue model is decided (see config).
        if settings.INQUIRY_ACCRUES_LEGACY_COMMISSION and listing.pays_commission:
            try:
                from app.features.leads.schemas import LeadTrackRequest
                from app.features.leads.service import LeadService

                async with db.begin_nested():
                    await LeadService.track_lead(
                        db,
                        LeadTrackRequest(listing_id=str(listing.id), contact_type="rumia_agent", fee_accepted=True),
                        ip_hash,
                    )
            except Exception:  # accounting must never block a seeker from reaching a landlord
                logger.exception("legacy lead/commission accrual failed for listing %s", listing.id)

        message = build_message(listing.title, listing.price, period, ref_code)
        wa = f"https://wa.me/{_digits_for_wa(number)}?text={quote(message)}" if data.channel == "whatsapp" else None
        tel = _tel(number) if data.channel == "call" else None
        notify = str(agent.user_id) if agent and agent.user_id else None
        return (
            InquiryResult(
                ref_code=ref_code, channel=data.channel, contact_name=name, whatsapp_url=wa, tel_url=tel,
                message=message, listing_is_full=bool(listing.is_full),
            ),
            notify,
            listing.title,
        )

    @staticmethod
    async def _owned(db: AsyncSession, ref_code: str, device_id: Optional[str]):
        """The inquiry, only for the device that made it (the ref code alone is not a secret)."""
        if not device_id:
            raise NotFoundException("Contact not found.")
        row = (
            await db.execute(
                text("SELECT id FROM inquiries WHERE ref_code = :r AND device_id = CAST(:d AS uuid)"),
                {"r": ref_code.upper(), "d": device_id},
            )
        ).first()
        if not row:
            raise NotFoundException("Contact not found.")
        return row[0]

    @staticmethod
    async def followup(db: AsyncSession, ref_code: str, device_id: Optional[str], replied: str) -> None:
        inquiry_id = await InquiryService._owned(db, ref_code, device_id)
        await db.execute(
            text("UPDATE inquiries SET replied = :r, replied_at = now() WHERE id = :i"),
            {"r": replied, "i": inquiry_id},
        )

    @staticmethod
    async def outcome(db: AsyncSession, ref_code: str, device_id: Optional[str], outcome: str) -> None:
        inquiry_id = await InquiryService._owned(db, ref_code, device_id)
        await InquiryService._set_outcome(db, inquiry_id, outcome, "seeker")

    @staticmethod
    async def lister_outcome(db: AsyncSession, org_id: str, ref_code: str, outcome: str) -> None:
        """The lister confirms the result for a contact on one of their organisation's places."""
        row = (
            await db.execute(
                text(
                    """
                    SELECT i.id FROM inquiries i JOIN properties p ON p.legacy_listing_id = i.listing_id
                    WHERE i.ref_code = :r AND p.org_id = CAST(:o AS uuid)
                    """
                ),
                {"r": ref_code.upper(), "o": org_id},
            )
        ).first()
        if not row:
            raise NotFoundException("Contact not found.")
        await InquiryService._set_outcome(db, row[0], outcome, "lister")

    @staticmethod
    async def _set_outcome(db: AsyncSession, inquiry_id, outcome: str, source: str) -> None:
        await db.execute(
            text("UPDATE inquiries SET outcome = :o, outcome_source = :s, outcome_at = now() WHERE id = :i"),
            {"o": outcome, "s": source, "i": inquiry_id},
        )
        # Money follows a confirmed move-in, never a click. Disabled until a fee is configured.
        if outcome == "moved_in" and settings.LEDGER_MOVE_IN_FEE_KES > 0:
            await db.execute(
                text(
                    """
                    INSERT INTO ledger_entries (kind, org_id, amount, inquiry_id, property_id, note)
                    SELECT 'move_in_fee', p.org_id, :fee, i.id, p.id, 'move-in confirmed by ' || :s
                    FROM inquiries i JOIN properties p ON p.legacy_listing_id = i.listing_id WHERE i.id = :i
                    ON CONFLICT (inquiry_id) WHERE kind = 'move_in_fee' DO NOTHING
                    """
                ),
                {"fee": settings.LEDGER_MOVE_IN_FEE_KES, "i": inquiry_id, "s": source},
            )
