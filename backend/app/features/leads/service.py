import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictException, ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.agents.models import AgentProfile
from app.features.campuses.models import Campus
from app.features.listings.models import Agent, Listing
from app.features.leads.models import Commission, Lead
from app.features.leads.schemas import (
    LeadContactAgent,
    LeadContactListing,
    LeadTrackRequest,
    LeadTrackResult,
)


@dataclass
class TrackedLead:
    result: LeadTrackResult
    notify_user_id: Optional[str]  # agent's user to push-notify (None for duplicates / unlinked agents)
    listing_title: str
    agent_id: str
    listing_id: str


class LeadService:
    @staticmethod
    async def _get_agent_ids_for_user(db: AsyncSession, user: AuthenticatedUser) -> List[str]:
        agent_ids = [user.id]
        res = await db.execute(select(AgentProfile.id).where(AgentProfile.user_id == user.id))
        agent_pk = res.scalar_one_or_none()
        if agent_pk and agent_pk not in agent_ids:
            agent_ids.append(agent_pk)
        return agent_ids

    @staticmethod
    async def track_lead(
        db: AsyncSession,
        data: LeadTrackRequest,
        ip_hash: str,
    ) -> TrackedLead:
        """Record a contact click and return what the caller needs to open the chat.

        Business rules (ported from the former Next.js route, now one DB transaction):
        - a full hostel cannot be contacted through its owner (409 REQUIRES_AGENT);
        - contacting a Rumia agent about a non-commission listing requires the student to
          have accepted the consultation-fee disclosure (409 FEE_REQUIRED);
        - the same visitor (ip hash) is only recorded once per listing per 24h;
        - a recorded lead on a commission-paying listing creates a pending commission
          (10% of price, minimum KSh 1,000) and adds it to the agent's balance.
        The lead is always attributed to the listing's own agent, never a client-supplied one.
        """
        res = await db.execute(select(Listing).where(Listing.id == data.listing_id))
        listing = res.scalar_one_or_none()
        if not listing:
            raise NotFoundException(f"Listing with id '{data.listing_id}' not found")

        if listing.is_full and data.contact_type == "hostel_owner":
            raise ConflictException(
                code="REQUIRES_AGENT",
                message=(
                    "This hostel is currently fully occupied. Contact the Rumia agent "
                    "for recommendations on other hostels."
                ),
            )

        agent_res = await db.execute(select(Agent).where(Agent.id == listing.agent_id))
        agent = agent_res.scalar_one_or_none()
        if not agent:
            raise NotFoundException("Agent not found for this listing")

        pays_commission = listing.pays_commission is True
        if data.contact_type == "rumia_agent" and not pays_commission and not data.fee_accepted:
            raise ConflictException(
                code="FEE_REQUIRED",
                message="Fee disclosure required before contacting a Rumia Agent.",
            )

        day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        dup = await db.execute(
            select(Lead.id)
            .where(Lead.listing_id == listing.id, Lead.ip_hash == ip_hash, Lead.clicked_at > day_ago)
            .limit(1)
        )
        is_duplicate = dup.scalar_one_or_none() is not None

        if not is_duplicate:
            db.add(
                Lead(
                    id=str(uuid.uuid4()),
                    listing_id=listing.id,
                    agent_id=agent.id,
                    clicked_at=datetime.now(timezone.utc),
                    ip_hash=ip_hash,
                    contact_type=data.contact_type,
                    name=data.name or None,
                    phone=data.phone or None,
                )
            )
            if pays_commission:
                amount = max(1000, round(float(listing.price) * 0.1))
                db.add(
                    Commission(
                        id=str(uuid.uuid4()),
                        agent_id=agent.id,
                        listing_id=listing.id,
                        amount=amount,
                        status="pending",
                    )
                )
                # Atomic increment: no lost updates when two leads land at once.
                await db.execute(
                    update(Agent)
                    .where(Agent.id == agent.id)
                    .values(commission_balance=func.coalesce(Agent.commission_balance, 0) + amount)
                )
            await db.flush()

        campus_fee = None
        if listing.campus_id:
            fee_res = await db.execute(select(Campus.consultation_fee).where(Campus.id == listing.campus_id))
            fee = fee_res.scalar_one_or_none()
            campus_fee = float(fee) if fee is not None else None

        result = LeadTrackResult(
            recorded=not is_duplicate,
            contact_type=data.contact_type,
            agent=LeadContactAgent(
                name=agent.name,
                whatsapp=agent.whatsapp,
                phone=agent.phone,
                pochi_la_biashara_number=agent.pochi_la_biashara_number,
                expected_name=agent.expected_name,
            ),
            listing=LeadContactListing(
                title=listing.title,
                price=float(listing.price),
                room_type=listing.room_type,
                area=listing.area,
                slug=listing.slug,
                county=listing.county,
                has_video=bool(listing.youtube_id),
                is_full=bool(listing.is_full),
                pays_commission=pays_commission,
                landlord_phone=listing.landlord_phone if data.contact_type == "hostel_owner" else None,
            ),
            consultation_fee=campus_fee,
        )
        notify_user_id = str(agent.user_id) if (not is_duplicate and agent.user_id) else None
        return TrackedLead(result=result, notify_user_id=notify_user_id, listing_title=listing.title,
                           agent_id=str(agent.id), listing_id=str(listing.id))

    @staticmethod
    async def list_leads(
        db: AsyncSession,
        user: AuthenticatedUser,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[Lead], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=20)

        stmt = select(Lead)
        if not user.is_admin:
            agent_ids = await LeadService._get_agent_ids_for_user(db, user)
            stmt = stmt.where(Lead.agent_id.in_(agent_ids))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(Lead.clicked_at.desc()).offset(pagination.offset).limit(pagination.limit)
        res = await db.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def list_commissions(
        db: AsyncSession,
        user: AuthenticatedUser,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[Commission], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=20)

        stmt = select(Commission)
        if not user.is_admin:
            agent_ids = await LeadService._get_agent_ids_for_user(db, user)
            stmt = stmt.where(Commission.agent_id.in_(agent_ids))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(Commission.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
        res = await db.execute(stmt)
        return list(res.scalars().all()), total


    @staticmethod
    async def pay_commission(
        db: AsyncSession,
        user: AuthenticatedUser,
        commission_id: str,
    ) -> Commission:
        if not user.is_admin:
            raise ForbiddenException("Only admins can mark commissions as paid")

        res = await db.execute(select(Commission).where(Commission.id == commission_id))
        comm = res.scalar_one_or_none()
        if not comm:
            raise NotFoundException(f"Commission '{commission_id}' not found")

        comm.status = "paid"
        comm.paid_at = datetime.now(timezone.utc)
        await db.flush()
        return comm
