from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException
from app.core.security import AuthenticatedUser
from app.features.agents.models import AgentProfile
from app.features.listings.models import Listing
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
