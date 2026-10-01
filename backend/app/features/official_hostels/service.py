import uuid
from datetime import date
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, ForbiddenException, NotFoundException
from app.core.security import AuthenticatedUser
from app.features.agents.models import AgentProfile
from app.features.listings.models import Listing
from app.features.listings.verification import raw_official_records
from app.features.official_hostels.models import OfficialHostel
from app.features.official_hostels.schemas import (
    AgentListingHostel,
    OfficialHostelRead,
    OfficialHostelsOverview,
)


class OfficialHostelService:
    @staticmethod
    async def assert_can_view(db: AsyncSession, user: AuthenticatedUser) -> None:
        """Agents (anyone with an agent record), managers and admins may see the official records."""
        if user.is_manager:  # managers and admins
            return
        res = await db.execute(select(AgentProfile.id).where(AgentProfile.user_id == user.id).limit(1))
        if res.scalar_one_or_none() is None:
            raise ForbiddenException("Only agents, managers and admins can view the official records")

    @staticmethod
    async def list_official(db: AsyncSession) -> List[OfficialHostel]:
        res = await db.execute(select(OfficialHostel).order_by(OfficialHostel.hostel_name.asc()))
        return list(res.scalars().all())

    @staticmethod
    async def overview(db: AsyncSession) -> OfficialHostelsOverview:
        official = await OfficialHostelService.list_official(db)
        res = await db.execute(
            select(Listing, AgentProfile)
            .join(AgentProfile, Listing.agent_id == AgentProfile.id, isouter=True)
            .order_by(Listing.created_at.desc())
        )
        listings = [
            AgentListingHostel(
                id=str(l.id), title=l.title, location=l.location or l.area or "DeKUT", price=float(l.price) if l.price is not None else None,
                is_active=bool(l.is_active), verified=bool(l.verified or (a.verified if a else False)),
                is_full=bool(l.is_full), created_at=l.created_at, landlord_phone=l.landlord_phone or "",
                mpesa_details=l.mpesa_details or "", specific_location=l.specific_location or "",
                county=l.county or "nyeri", area=l.area or "dekut", slug=l.slug,
                agent_name=(a.name if a else None) or "Agent", agent_phone=(a.phone if a else None) or "",
                agent_whatsapp=(a.whatsapp if a else None) or "",
            )
            for l, a in res.all()
        ]
        return OfficialHostelsOverview(
            official_hostels=[OfficialHostelRead.model_validate(o) for o in official], listings=listings
        )


    # ── Admin writes ────────────────────────────────────────────────────────

    @staticmethod
    def _require_admin(user: AuthenticatedUser) -> None:
        if not user.is_admin:
            raise ForbiddenException("Admin role required")

    @staticmethod
    async def create(db: AsyncSession, user: AuthenticatedUser, data) -> OfficialHostel:
        OfficialHostelService._require_admin(user)
        if not data.hostel_name.strip() or not (data.zone or "").strip():
            raise BadRequestException("Hostel name and zone are required.")
        row = OfficialHostel(
            id=str(uuid.uuid4()), hostel_name=data.hostel_name.strip(), zone=data.zone.strip(),
            contacts=(data.contacts or "").strip(), payments=(data.payments or "").strip(),
            source=(data.source or "").strip() or "DeKUT Official Housing List",
            verified_date=data.verified_date or date.today(),
        )
        db.add(row)
        await db.flush()
        return row

    @staticmethod
    async def _get(db: AsyncSession, record_id: str) -> OfficialHostel:
        row = (await db.execute(select(OfficialHostel).where(OfficialHostel.id == record_id))).scalar_one_or_none()
        if row is None:
            raise NotFoundException("Official hostel record not found")
        return row

    @staticmethod
    async def update(db: AsyncSession, user: AuthenticatedUser, record_id: str, data) -> OfficialHostel:
        OfficialHostelService._require_admin(user)
        if not data.hostel_name.strip() or not (data.zone or "").strip():
            raise BadRequestException("Hostel name and zone are required.")
        row = await OfficialHostelService._get(db, record_id)
        row.hostel_name = data.hostel_name.strip()
        row.zone = data.zone.strip()
        row.contacts = (data.contacts or "").strip()
        row.payments = (data.payments or "").strip()
        row.source = (data.source or "").strip() or "DeKUT Official Housing List"
        await db.flush()
        return row

    @staticmethod
    async def delete(db: AsyncSession, user: AuthenticatedUser, record_id: str) -> None:
        OfficialHostelService._require_admin(user)
        await db.delete(await OfficialHostelService._get(db, record_id))
        await db.flush()

    @staticmethod
    async def seed(db: AsyncSession, user: AuthenticatedUser) -> int:
        """Load the bundled official records. Idempotent: names already present are skipped."""
        OfficialHostelService._require_admin(user)
        existing = {n for n in (await db.execute(select(OfficialHostel.hostel_name))).scalars().all()}
        seeded = 0
        for rec in raw_official_records():
            if rec["hostel_name"] in existing:
                continue
            db.add(OfficialHostel(
                id=str(uuid.uuid4()), hostel_name=rec["hostel_name"], zone=rec.get("zone") or "DeKUT",
                contacts=rec.get("contacts") or "", payments=rec.get("payments") or "",
                source="DeKUT Official Housing List", verified_date=date(2026, 7, 14),
            ))
            seeded += 1
        await db.flush()
        return seeded
