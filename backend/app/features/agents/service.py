import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.agents.models import AgentApplication, AgentProfile
from app.features.agents.schemas import AgentApplicationCreate, AgentApplicationReview, AgentUpdate


class AgentService:
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
    async def update_agent_profile(db: AsyncSession, user: AuthenticatedUser, agent_id: str, data: AgentUpdate) -> AgentProfile:
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
        if data.profile_image_url is not None:
            agent.profile_image_url = data.profile_image_url

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
