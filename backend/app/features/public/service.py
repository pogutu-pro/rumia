import uuid
from typing import List

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundException
from app.features.agents.models import AgentProfile
from app.features.listings.models import Listing
from app.features.public.schemas import (
    PublicAgent,
    SitemapAgent,
    SitemapListing,
    SitemapResponse,
    VerifyCandidate,
)


def _public_agent(agent: AgentProfile) -> PublicAgent:
    data = PublicAgent.model_validate(agent)
    if not agent.instagram_public:
        data.instagram = None
    if not agent.linkedin_public:
        data.linkedin = None
    return data


class PublicService:
    @staticmethod
    async def get_agent(db: AsyncSession, slug_or_id: str) -> PublicAgent:
        """An active agent by slug, or by id (legacy URLs redirect to the slug)."""
        try:
            key = AgentProfile.id == str(uuid.UUID(slug_or_id))
        except ValueError:
            key = AgentProfile.slug == slug_or_id
        res = await db.execute(select(AgentProfile).where(key, AgentProfile.status == "active"))
        agent = res.scalar_one_or_none()
        if agent is None:
            raise NotFoundException("Agent not found")
        return _public_agent(agent)

    @staticmethod
    async def support_team(db: AsyncSession) -> List[PublicAgent]:
        res = await db.execute(
            select(AgentProfile)
            .where(AgentProfile.status == "active", AgentProfile.is_support.is_(True))
            .order_by(AgentProfile.support_rank.asc().nulls_last(), AgentProfile.name.asc())
        )
        return [_public_agent(a) for a in res.scalars().all()]

    @staticmethod
    async def verify_lookup(db: AsyncSession, query: str) -> List[VerifyCandidate]:
        """Active listings that match ONE phone number, M-Pesa detail or name the visitor typed.

        Replaces the old bulk dump of every listing's contacts and payment details: only rows that match
        what the visitor already has are returned (at most 10), and payment details are included only when
        the visitor searched by them.
        """
        q = (query or "").strip()
        digits = "".join(ch for ch in q if ch.isdigit())
        by_phone = len(digits) >= 7  # enough digits to identify a phone number
        by_payment = len(digits) >= 5  # till / paybill / pochi numbers can be shorter
        suffix = digits[-9:]

        def digits_of(col):
            return func.regexp_replace(func.coalesce(col, ""), r"\D", "", "g")

        conditions = []
        if by_phone:
            conditions.append(digits_of(Listing.landlord_phone).like(f"%{suffix}"))
            conditions.append(digits_of(AgentProfile.phone).like(f"%{suffix}"))
            conditions.append(digits_of(AgentProfile.whatsapp).like(f"%{suffix}"))
        if by_payment:
            conditions.append(digits_of(Listing.mpesa_details).like(f"%{digits}%"))
        if not by_payment and len(q) >= 3:
            conditions.append(Listing.title.ilike(f"%{q}%"))
        if not conditions:
            return []

        res = await db.execute(
            select(Listing, AgentProfile)
            .join(AgentProfile, Listing.agent_id == AgentProfile.id, isouter=True)
            .where(Listing.is_active.is_(True), or_(*conditions))
            .limit(10)
        )
        out = []
        for listing, agent in res.all():
            payment_matched = by_payment and digits in "".join(ch for ch in (listing.mpesa_details or "") if ch.isdigit())
            out.append(VerifyCandidate(
                id=str(listing.id), title=listing.title, county=listing.county, area=listing.area,
                slug=listing.slug, landlord_phone=listing.landlord_phone,
                agent_phone=agent.phone if agent else None,
                agent_whatsapp=agent.whatsapp if agent else None,
                agent_verified=agent.verified if agent else None,
                verified=listing.verified,
                mpesa_details=listing.mpesa_details if payment_matched else None,
                specific_location=listing.specific_location,
            ))
        return out

    @staticmethod
    async def sitemap(db: AsyncSession) -> SitemapResponse:
        listings = await db.execute(
            select(Listing.slug, Listing.county, Listing.area, Listing.updated_at)
            .where(Listing.is_active.is_(True), Listing.slug.is_not(None))
        )
        agents = await db.execute(
            select(AgentProfile.slug, AgentProfile.updated_at)
            .where(AgentProfile.status == "active", AgentProfile.slug.is_not(None))
        )
        return SitemapResponse(
            listings=[SitemapListing(slug=r.slug, county=r.county, area=r.area, updated_at=r.updated_at) for r in listings.all()],
            agents=[SitemapAgent(slug=r.slug, updated_at=r.updated_at) for r in agents.all()],
        )
