import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.listings.models import Listing
from app.features.leads.models import Commission, Lead
from app.features.leads.schemas import LeadTrackRequest


class LeadService:
    @staticmethod
    async def track_lead(
        db: AsyncSession,
        data: LeadTrackRequest,
        user: Optional[AuthenticatedUser] = None,
    ) -> Lead:
        res = await db.execute(select(Listing).where(Listing.id == data.listing_id))
        listing = res.scalar_one_or_none()
        if not listing:
            raise NotFoundException(f"Listing with id '{data.listing_id}' not found")

        lead = Lead(
            id=str(uuid.uuid4()),
            listing_id=data.listing_id,
            agent_id=listing.agent_id,
            clicked_at=datetime.now(timezone.utc),
            ip_hash=data.ip_hash,
            source=data.source or "whatsapp",
            user_id=user.id if user else None,
            campus_id=listing.campus_id,
        )
        db.add(lead)
        await db.flush()

        # Fire server-side analytics event (best-effort, non-blocking)
        from app.core.integrations import posthog as ph
        ph.track_lead_created(
            user_id=user.id if user else lead.id,
            listing_id=data.listing_id,
            agent_id=str(listing.agent_id) if listing.agent_id else "",
        )

        return lead


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
            stmt = stmt.where(Lead.agent_id == user.id)

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
            stmt = stmt.where(Commission.agent_id == user.id)

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
