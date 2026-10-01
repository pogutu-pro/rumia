import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.agents.models import AgentApplication, AgentProfile
from app.features.agents.schemas import (
    AgentApplicationCreate,
    AgentApplicationReview,
    AgentDashboardRead,
    AgentSelfRead,
    AgentUpdate,
)
from app.features.leads.models import Lead
from app.features.listings.models import Listing
from app.features.profiles.models import UserProfile
from app.features.tours.models import TourBooking


# Placeholder used when an admin/manager has no phone on file (matches the former dashboard behaviour).
DEFAULT_AGENT_PHONE = "+254114845619"


class AgentService:
    @staticmethod
    async def ensure_agent(db: AsyncSession, user: AuthenticatedUser, display_name: Optional[str]) -> AgentProfile:
        """Admins/managers open the agent dashboard without applying: create their agent record on
        first visit (ported from the former dashboard page). Everyone else must apply."""
        res = await db.execute(select(AgentProfile).where(AgentProfile.user_id == user.id))
        agent = res.scalar_one_or_none()
        if agent:
            return agent
        if user.role not in ("admin", "manager", "super_admin"):
            raise ForbiddenException("Apply to become an agent first")
        phone_res = await db.execute(
            select(UserProfile.phone, UserProfile.full_name, UserProfile.campus_id).where(UserProfile.id == user.id)
        )
        row = phone_res.first()
        phone = (row.phone if row and row.phone else DEFAULT_AGENT_PHONE)
        agent = AgentProfile(
            id=str(uuid.uuid4()), user_id=user.id, name=(display_name or (row.full_name if row else None) or "New Agent"),
            phone=phone, whatsapp=phone, commission_balance=0, status="active",
            # agents.campus_id is NOT NULL: use the staff member's scope, else their profile campus.
            campus_id=user.managed_campus_id or (str(row.campus_id) if row and row.campus_id else None),
            created_at=datetime.now(timezone.utc),
        )
        db.add(agent)
        await db.flush()
        return agent

    @staticmethod
    async def dashboard(db: AsyncSession, user: AuthenticatedUser) -> AgentDashboardRead:
        agent = await AgentService.get_agent_by_user_id(db, user.id)
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        async def scalar(stmt):
            return (await db.execute(stmt)).scalar_one() or 0

        listing_count = await scalar(select(func.count(Listing.id)).where(Listing.agent_id == agent.id))
        active_count = await scalar(
            select(func.count(Listing.id)).where(Listing.agent_id == agent.id, Listing.is_active.is_(True))
        )
        total_leads = await scalar(select(func.count(Lead.id)).where(Lead.agent_id == agent.id))
        month_leads = await scalar(
            select(func.count(Lead.id)).where(Lead.agent_id == agent.id, Lead.clicked_at >= month_start)
        )
        pending = await scalar(
            select(func.count(TourBooking.id)).where(
                TourBooking.agent_id == agent.id, TourBooking.status.in_(("pending_payment", "confirmed", "contacted"))
            )
        )
        earnings = await scalar(
            select(func.coalesce(func.sum(TourBooking.amount), 0)).where(
                TourBooking.agent_id == agent.id, TourBooking.status.in_(("paid", "completed"))
            )
        )
        has_payment = bool(
            (agent.pochi_la_biashara_number or "").strip() and (agent.expected_name or "").strip()
        )
        return AgentDashboardRead(
            agent=AgentSelfRead.model_validate(agent), has_payment_details=has_payment,
            listing_count=int(listing_count), active_listing_count=int(active_count),
            leads_this_month=int(month_leads), total_leads=int(total_leads),
            pending_tours=int(pending), tour_earnings=float(earnings),
        )

    @staticmethod
    async def my_listings(
        db: AsyncSession, user: AuthenticatedUser, property_type: Optional[str] = None
    ) -> List[Tuple[Listing, int]]:
        """All of the agent's listings (active or not), newest first, with their lead counts."""
        agent = await AgentService.get_agent_by_user_id(db, user.id)
        stmt = select(Listing).where(Listing.agent_id == agent.id)
        if property_type:
            stmt = stmt.where(Listing.property_type == property_type)
        listings = list((await db.execute(stmt.order_by(Listing.created_at.desc()))).scalars().all())
        counts = {}
        if listings:
            res = await db.execute(
                select(Lead.listing_id, func.count(Lead.id))
                .where(Lead.agent_id == agent.id)
                .group_by(Lead.listing_id)
            )
            counts = {str(lid): int(n) for lid, n in res.all()}
        return [(item, counts.get(str(item.id), 0)) for item in listings]

    @staticmethod
    async def get_agents(db: AsyncSession, campus_id: Optional[str] = None) -> List[AgentProfile]:
        stmt = select(AgentProfile).where(AgentProfile.status == "active")
        if campus_id:
            stmt = stmt.where(AgentProfile.campus_id == campus_id)
        stmt = stmt.order_by(AgentProfile.is_featured.desc(), AgentProfile.name.asc())
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_agent_by_id(db: AsyncSession, agent_id: str) -> AgentProfile:
        res = await db.execute(select(AgentProfile).where(AgentProfile.id == agent_id))
        agent = res.scalar_one_or_none()
        if not agent:
            raise NotFoundException(f"Agent with id '{agent_id}' not found")
        return agent

    @staticmethod
    async def get_agent_by_user_id(db: AsyncSession, user_id: str) -> AgentProfile:
        res = await db.execute(select(AgentProfile).where(AgentProfile.user_id == user_id))
        agent = res.scalar_one_or_none()
        if not agent:
            raise NotFoundException("Agent profile not found for current user")
        return agent

    @staticmethod
    async def update_agent_profile(db: AsyncSession, user: AuthenticatedUser, agent_id: str, data: AgentUpdate) -> AgentProfile:
        if agent_id == "me":
            agent = await AgentService.get_agent_by_user_id(db, user.id)
        else:
            agent = await AgentService.get_agent_by_id(db, agent_id)
            if agent.user_id != user.id and not user.is_admin:
                raise ForbiddenException("You can only edit your own agent profile")

        if data.name is not None:
            agent.name = data.name
        if data.phone is not None:
            agent.phone = data.phone
        if data.whatsapp is not None:
            agent.whatsapp = data.whatsapp
        if data.bio is not None:
            agent.bio = data.bio
        if data.portfolio_url is not None:
            agent.portfolio_url = data.portfolio_url
        photo_url = data.profile_photo_url or data.profile_image_url
        if photo_url is not None:
            agent.profile_photo_url = photo_url

        await db.flush()
        return agent

    @staticmethod
    async def submit_application(db: AsyncSession, user: AuthenticatedUser, data: AgentApplicationCreate) -> AgentApplication:
        app_obj = AgentApplication(
            id=str(uuid.uuid4()),
            user_id=user.id,
            campus_id=data.campus_id,
            full_name=data.full_name,
            phone=data.phone,
            id_number=data.id_number,
            hostel_name=data.hostel_name,
            relationship_to_hostel=data.relationship_to_hostel,
            owner_contact=data.owner_contact,
            status="pending",
            created_at=datetime.now(timezone.utc),
        )
        db.add(app_obj)
        await db.flush()
        return app_obj

    @staticmethod
    async def get_user_applications(db: AsyncSession, user_id: str) -> List[AgentApplication]:
        res = await db.execute(select(AgentApplication).where(AgentApplication.user_id == user_id).order_by(AgentApplication.created_at.desc()))
        return list(res.scalars().all())

    @staticmethod
    async def list_applications(
        db: AsyncSession,
        status_filter: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[AgentApplication], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=20)

        stmt = select(AgentApplication)
        if status_filter:
            stmt = stmt.where(AgentApplication.status == status_filter)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(AgentApplication.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
        res = await db.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def review_application(
        db: AsyncSession,
        user: AuthenticatedUser,
        application_id: str,
        review_data: AgentApplicationReview,
    ) -> AgentApplication:
        if not user.is_manager and not user.is_admin:
            raise ForbiddenException("Only managers and admins can review agent applications")

        res = await db.execute(select(AgentApplication).where(AgentApplication.id == application_id))
        app_obj = res.scalar_one_or_none()
        if not app_obj:
            raise NotFoundException(f"Application '{application_id}' not found")

        app_obj.status = review_data.status
        app_obj.reviewed_by = user.id
        app_obj.reviewed_at = datetime.now(timezone.utc)
        if review_data.rejection_reason:
            app_obj.rejection_reason = review_data.rejection_reason

        # If approved, convert user to agent profile if not existing
        if review_data.status == "approved":
            res_agent = await db.execute(select(AgentProfile).where(AgentProfile.user_id == app_obj.user_id))
            existing_agent = res_agent.scalar_one_or_none()
            if not existing_agent:
                new_agent = AgentProfile(
                    id=str(uuid.uuid4()),
                    name=app_obj.full_name,
                    phone=app_obj.phone,
                    whatsapp=app_obj.phone,
                    status="active",
                    campus_id=app_obj.campus_id,
                    user_id=app_obj.user_id,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(new_agent)

        await db.flush()
        return app_obj
