import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.agents.models import AgentProfile
from app.features.tours.models import TourBooking
from app.features.tours.schemas import TourBookingCreate, TourBookingUpdateStatus


class TourService:
    @staticmethod
    async def _get_agent_ids_for_user(db: AsyncSession, user: AuthenticatedUser) -> List[str]:
        agent_ids = [user.id]
        res = await db.execute(select(AgentProfile.id).where(AgentProfile.user_id == user.id))
        agent_pk = res.scalar_one_or_none()
        if agent_pk and agent_pk not in agent_ids:
            agent_ids.append(agent_pk)
        return agent_ids

    @staticmethod
    async def create_booking(
        db: AsyncSession,
        data: TourBookingCreate,
        user: Optional[AuthenticatedUser] = None,
    ) -> TourBooking:
        booking = TourBooking(
            id=str(uuid.uuid4()),
            student_name=data.student_name,
            phone=data.phone,
            listing_id=data.listing_id,
            zone=data.zone,
            tour_type=data.tour_type,
            amount=data.amount,
            preferred_date=data.preferred_date,
            preferred_time=data.preferred_time,
            status="pending_payment",
            linked_user_id=user.id if user else None,
            agent_id=data.agent_id,
            contacted=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(booking)
        await db.flush()
        return booking

    @staticmethod
    async def list_bookings(
        db: AsyncSession,
        user: AuthenticatedUser,
        status_filter: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[TourBooking], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=20)

        stmt = select(TourBooking)
        if not user.is_admin:
            agent_ids = await TourService._get_agent_ids_for_user(db, user)
            stmt = stmt.where(TourBooking.agent_id.in_(agent_ids))

        if status_filter:
            stmt = stmt.where(TourBooking.status == status_filter)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(TourBooking.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
        res = await db.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def list_my_tours(
        db: AsyncSession,
        user: AuthenticatedUser,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[TourBooking], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=20)

        stmt = select(TourBooking).where(TourBooking.linked_user_id == user.id)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(TourBooking.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
        res = await db.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_booking_by_id(db: AsyncSession, user: AuthenticatedUser, booking_id: str) -> TourBooking:
        res = await db.execute(select(TourBooking).where(TourBooking.id == booking_id))
        booking = res.scalar_one_or_none()
        if not booking:
            raise NotFoundException(f"Booking with id '{booking_id}' not found")

        agent_ids = await TourService._get_agent_ids_for_user(db, user)
        if not user.is_admin and booking.agent_id not in agent_ids and booking.linked_user_id != user.id:
            raise ForbiddenException("Not authorized to view this booking")

        return booking

    @staticmethod
    async def update_booking_status(
        db: AsyncSession,
        user: AuthenticatedUser,
        booking_id: str,
        data: TourBookingUpdateStatus,
    ) -> TourBooking:
        res = await db.execute(select(TourBooking).where(TourBooking.id == booking_id))
        booking = res.scalar_one_or_none()
        if not booking:
            raise NotFoundException(f"Booking with id '{booking_id}' not found")

        agent_ids = await TourService._get_agent_ids_for_user(db, user)
        if not user.is_admin and booking.agent_id not in agent_ids:
            raise ForbiddenException("Not authorized to update this booking")

        booking.status = data.status
        if data.contacted is not None:
            booking.contacted = data.contacted
        booking.updated_at = datetime.now(timezone.utc)

        await db.flush()
        return booking
