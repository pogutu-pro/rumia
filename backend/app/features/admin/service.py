import uuid
from app.core.permissions import sync_staff_for_role
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.admin.models import TransferHistory
from app.features.admin.schemas import CampusCreate, CampusStatusUpdate, CampusUpdate, ListingTransferRequest, ManagerAssign, PlatformStats
from app.features.agents.models import AgentProfile
from app.features.campuses.models import Campus
from app.features.listings.models import Listing
from app.features.profiles.models import UserProfile


class AdminService:
    @staticmethod
    async def create_campus(db: AsyncSession, user: AuthenticatedUser, data: CampusCreate) -> Campus:
        if not user.is_admin:
            raise ForbiddenException("Only admins can create campuses")

        campus = Campus(
            id=str(uuid.uuid4()),
            slug=data.slug,
            name=data.name,
            city=data.city,
            hero_headline=data.hero_headline,
            hero_subtext=data.hero_subtext,
            whatsapp_number=data.whatsapp_number,
            primary_color=data.primary_color,
            feature_flags=data.feature_flags or {},
            region_id=data.region_id or None,
            hero_image=data.hero_image,
            status=data.status,
            created_at=datetime.now(timezone.utc),
        )
        db.add(campus)
        await db.flush()
        return campus

    @staticmethod
    async def update_campus(db: AsyncSession, user: AuthenticatedUser, campus_id: str, data: CampusUpdate) -> Campus:
        if not user.is_admin:
            raise ForbiddenException("Only admins can update campuses")

        res = await db.execute(select(Campus).where(Campus.id == campus_id))
        campus = res.scalar_one_or_none()
        if not campus:
            raise NotFoundException(f"Campus '{campus_id}' not found")

        if data.name is not None:
            campus.name = data.name
        if data.slug is not None:
            campus.slug = data.slug.strip().lower()
        if data.region_id is not None:
            campus.region_id = data.region_id or None
        if data.city is not None:
            campus.city = data.city
        if data.hero_headline is not None:
            campus.hero_headline = data.hero_headline
        if data.hero_subtext is not None:
            campus.hero_subtext = data.hero_subtext
        if data.whatsapp_number is not None:
            campus.whatsapp_number = data.whatsapp_number
        if data.primary_color is not None:
            campus.primary_color = data.primary_color
        if data.feature_flags is not None:
            campus.feature_flags = data.feature_flags
        if data.status is not None:
            campus.status = data.status

        await db.flush()
        return campus

    @staticmethod
    async def update_campus_status(db: AsyncSession, user: AuthenticatedUser, campus_id: str, data: CampusStatusUpdate) -> Campus:
        return await AdminService.update_campus(db, user, campus_id, CampusUpdate(status=data.status))

    @staticmethod
    async def assign_manager(db: AsyncSession, user: AuthenticatedUser, data: ManagerAssign) -> UserProfile:
        if not user.is_admin:
            raise ForbiddenException("Only admins can assign managers")

        res = await db.execute(select(UserProfile).where(UserProfile.id == data.user_id))
        prof = res.scalar_one_or_none()
        if not prof:
            prof = UserProfile(id=data.user_id, role="manager", created_at=datetime.now(timezone.utc))
            db.add(prof)
        else:
            prof.role = "manager"

        prof.managed_campus_id = data.managed_campus_id
        prof.managed_region_id = data.managed_region_id
        await db.flush()
        await sync_staff_for_role(db, str(data.user_id), "manager")
        return prof

    @staticmethod
    async def list_managers(db: AsyncSession, user: AuthenticatedUser) -> List[UserProfile]:
        if not user.is_admin:
            raise ForbiddenException("Only admins can list managers")

        res = await db.execute(select(UserProfile).where(UserProfile.role == "manager"))
        return list(res.scalars().all())

    @staticmethod
    async def update_agent_status(db: AsyncSession, user: AuthenticatedUser, agent_id: str, new_status: str) -> AgentProfile:
        if not user.is_admin:
            raise ForbiddenException("Only admins can update agent status")

        res = await db.execute(select(AgentProfile).where(AgentProfile.id == agent_id))
        agent = res.scalar_one_or_none()
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' not found")

        agent.status = new_status
        await db.flush()
        return agent

    @staticmethod
    async def transfer_listing(db: AsyncSession, user: AuthenticatedUser, data: ListingTransferRequest) -> TransferHistory:
        if not user.is_admin:
            raise ForbiddenException("Only admins can transfer listing ownership")

        res_l = await db.execute(select(Listing).where(Listing.id == data.listing_id))
        listing = res_l.scalar_one_or_none()
        if not listing:
            raise NotFoundException(f"Listing '{data.listing_id}' not found")

        prev_owner_id = listing.agent_id
        listing.agent_id = data.new_agent_id

        history = TransferHistory(
            id=str(uuid.uuid4()),
            listing_id=data.listing_id,
            previous_owner_id=prev_owner_id,
            new_owner_id=data.new_agent_id,
            transferred_by=user.id,
            transferred_at=datetime.now(timezone.utc),
        )
        db.add(history)
        await db.flush()
        return history

    @staticmethod
    async def get_platform_stats(db: AsyncSession, user: AuthenticatedUser) -> PlatformStats:
        if not user.is_admin:
            raise ForbiddenException("Only admins can view platform stats")

        total_l = (await db.execute(select(func.count()).select_from(Listing))).scalar_one()
        active_l = (await db.execute(select(func.count()).select_from(Listing).where(Listing.is_active.is_(True)))).scalar_one()
        total_a = (await db.execute(select(func.count()).select_from(AgentProfile))).scalar_one()
        total_s = (await db.execute(select(func.count()).select_from(UserProfile).where(UserProfile.role == "student"))).scalar_one()

        return PlatformStats(
            total_listings=total_l,
            active_listings=active_l,
            total_agents=total_a,
            total_students=total_s,
        )
