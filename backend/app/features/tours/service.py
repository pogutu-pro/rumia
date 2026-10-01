import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser
from app.features.agents.models import AgentProfile
from app.features.campuses.models import Campus
from app.features.listings.models import Agent, Listing
from app.features.profiles.models import UserProfile
from app.features.tours.models import TourBooking
from app.features.tours.schemas import TourBookingCreate, TourBookingStudentUpdate, TourBookingUpdateStatus
from app.features.zones.models import CampusZone

# Allowed staff (agent/admin) status transitions; mirrors the former web rules.
STATUS_TRANSITIONS = {
    "pending_payment": ("confirmed", "paid", "cancelled", "no_show", "contacted"),
    "confirmed": ("paid", "cancelled", "no_show", "contacted"),
    "paid": ("completed", "cancelled"),
    "contacted": (),
    "completed": (),
    "no_show": (),
    "cancelled": (),
}
STATUS_LABELS = {
    "confirmed": "confirmed",
    "paid": "payment received",
    "completed": "completed",
    "cancelled": "cancelled",
    "no_show": "marked as no-show",
    "contacted": "confirmed by your agent",
}


@dataclass
class PushMessage:
    user_id: str
    title: str
    body: str
    url: str


def _today_nairobi() -> date:
    return datetime.now(ZoneInfo("Africa/Nairobi")).date()


class TourService:
    @staticmethod
    async def _get_agent_ids_for_user(db: AsyncSession, user: AuthenticatedUser) -> List[str]:
        res = await db.execute(select(AgentProfile.id).where(AgentProfile.user_id == user.id))
        return [str(agent_id) for agent_id in res.scalars().all()]

    @staticmethod
    async def _admin_user_ids(db: AsyncSession) -> List[str]:
        res = await db.execute(select(UserProfile.id).where(UserProfile.role == "admin"))
        return [str(user_id) for user_id in res.scalars().all()]

    @staticmethod
    async def _agent_user_id(db: AsyncSession, agent_id: Optional[str]) -> Optional[str]:
        if not agent_id:
            return None
        res = await db.execute(select(Agent.user_id).where(Agent.id == agent_id))
        user_id = res.scalar_one_or_none()
        return str(user_id) if user_id else None

    @staticmethod
    async def get_zone_price(db: AsyncSession, zone: str, campus_id: Optional[str]) -> Optional[int]:
        """Configured tour price for a zone on an ACTIVE campus; None if unset or ambiguous.

        Only manager-configured `campus_zones.full_search_price` is used, with no fallback, so a
        student can never be quoted an amount no manager set.
        """
        stmt = (
            select(CampusZone.full_search_price)
            .join(Campus, CampusZone.campus_id == Campus.id)
            .where(CampusZone.name == zone, Campus.status == "active")
        )
        if campus_id:
            stmt = stmt.where(CampusZone.campus_id == campus_id)
        rows = (await db.execute(stmt.limit(2))).scalars().all()
        return int(rows[0]) if len(rows) == 1 and rows[0] is not None else None

    @staticmethod
    async def _resolve_agent_id(db: AsyncSession, data: TourBookingCreate) -> Optional[str]:
        if data.agent_id:
            exists = await db.execute(select(Agent.id).where(Agent.id == data.agent_id))
            if exists.scalar_one_or_none():
                return data.agent_id
        if data.listing_id:
            res = await db.execute(select(Listing.agent_id).where(Listing.id == data.listing_id))
            agent_id = res.scalar_one_or_none()
            if agent_id:
                return str(agent_id)
        # Standalone full-search bookings go to the first agent.
        res = await db.execute(select(Agent.id).order_by(Agent.created_at.asc()).limit(1))
        first = res.scalar_one_or_none()
        return str(first) if first else None

    @staticmethod
    async def create_booking(
        db: AsyncSession,
        data: TourBookingCreate,
        user: Optional[AuthenticatedUser] = None,
    ) -> Tuple[TourBooking, List[PushMessage]]:
        """Create a booking priced server-side; returns it with the push notifications to send."""
        if len(re.sub(r"\D", "", data.phone)) < 7:
            raise BadRequestException("Please enter a valid phone number")
        if data.preferred_date < _today_nairobi():
            raise BadRequestException("Tour date must be in the future")

        amount = await TourService.get_zone_price(db, data.zone, data.campus_id)
        if amount is None:
            raise BadRequestException(f"No pricing configured for zone: {data.zone}")

        agent_id = await TourService._resolve_agent_id(db, data)
        name = data.student_name.strip()
        booking = TourBooking(
            id=str(uuid.uuid4()),
            student_name=name,
            phone=data.phone.strip(),
            listing_id=data.listing_id,
            zone=data.zone,
            tour_type=data.tour_type,
            amount=amount,
            preferred_date=data.preferred_date,
            preferred_time=data.preferred_time,
            status="pending_payment",
            linked_user_id=user.id if user else None,
            agent_id=agent_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(booking)
        await db.flush()

        pushes: List[PushMessage] = []
        if agent_user := await TourService._agent_user_id(db, agent_id):
            pushes.append(PushMessage(
                agent_user, "New tour booking",
                f"{name} booked a tour in {data.zone} for {data.preferred_time} on {data.preferred_date.isoformat()}",
                "/dashboard/tours",
            ))
        if user:
            pushes.append(PushMessage(
                user.id, "Tour booking received",
                f"Your tour in {data.zone} is booked for {data.preferred_date.isoformat()}. An agent will confirm shortly.",
                "/account?tab=tours",
            ))
        for admin_id in await TourService._admin_user_ids(db):
            pushes.append(PushMessage(admin_id, "New tour booking", f"{name} booked a tour in {data.zone}.", "/admin/tours"))
        return booking, pushes

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
        sort: str = "created_desc",
    ) -> Tuple[List[TourBooking], int]:
        if pagination is None:
            pagination = PaginationParams(page=1, limit=20)

        stmt = select(TourBooking).where(TourBooking.linked_user_id == user.id)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar_one()

        if sort == "upcoming":
            order = (TourBooking.preferred_date.asc(), TourBooking.preferred_time.asc())
        else:
            order = (TourBooking.created_at.desc(),)
        stmt = stmt.order_by(*order).offset(pagination.offset).limit(pagination.limit)
        res = await db.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_listings_by_id(db: AsyncSession, listing_ids: List[str]) -> dict:
        """Map listing id -> Listing (images eager-loaded) for embedding in booking reads."""
        ids = [i for i in set(listing_ids) if i]
        if not ids:
            return {}
        res = await db.execute(select(Listing).where(Listing.id.in_(ids)))
        return {str(listing.id): listing for listing in res.scalars().all()}

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
    async def _load(db: AsyncSession, booking_id: str) -> TourBooking:
        res = await db.execute(select(TourBooking).where(TourBooking.id == booking_id))
        booking = res.scalar_one_or_none()
        if not booking:
            raise NotFoundException(f"Booking with id '{booking_id}' not found")
        return booking

    @staticmethod
    async def _is_booking_agent(db: AsyncSession, user: AuthenticatedUser, booking: TourBooking) -> bool:
        return bool(booking.agent_id) and str(booking.agent_id) in await TourService._get_agent_ids_for_user(db, user)

    @staticmethod
    async def update_booking_status(
        db: AsyncSession,
        user: AuthenticatedUser,
        booking_id: str,
        data: TourBookingUpdateStatus,
    ) -> Tuple[TourBooking, List[PushMessage]]:
        """Move a booking through its lifecycle.

        - The booking's agent or an admin may apply any transition in STATUS_TRANSITIONS.
        - The student who owns the booking may only cancel it while pending_payment/confirmed.
        """
        booking = await TourService._load(db, booking_id)
        is_staff = user.is_admin or await TourService._is_booking_agent(db, user, booking)
        is_owner = booking.linked_user_id is not None and str(booking.linked_user_id) == user.id

        if not is_staff:
            if not (is_owner and data.status == "cancelled"):
                raise ForbiddenException("Not authorized to update this booking")
            if booking.status not in ("pending_payment", "confirmed"):
                raise BadRequestException("This booking cannot be cancelled")
        elif data.status not in STATUS_TRANSITIONS.get(booking.status, ()):
            raise BadRequestException(
                f'Cannot transition from "{booking.status.replace("_", " ")}" to "{data.status.replace("_", " ")}"'
            )

        booking.status = data.status
        booking.updated_at = datetime.now(timezone.utc)
        await db.flush()

        pushes: List[PushMessage] = []
        if is_staff and booking.linked_user_id:
            label = STATUS_LABELS.get(data.status, data.status.replace("_", " "))
            pushes.append(PushMessage(
                str(booking.linked_user_id), "Tour update",
                f"Your tour booking has been {label} ({booking.student_name})", "/account?tab=tours",
            ))
        if not is_staff and (agent_user := await TourService._agent_user_id(db, booking.agent_id)):
            pushes.append(PushMessage(
                agent_user, "Tour cancelled",
                "A student cancelled their tour booking. Check your dashboard.", "/dashboard/tours",
            ))
        return booking, pushes

    @staticmethod
    async def update_my_booking(
        db: AsyncSession,
        user: AuthenticatedUser,
        booking_id: str,
        data: TourBookingStudentUpdate,
    ) -> Tuple[TourBooking, List[PushMessage]]:
        """Let a student change date/time/phone of their own booking while it is pending payment."""
        booking = await TourService._load(db, booking_id)
        if booking.linked_user_id is None or str(booking.linked_user_id) != user.id:
            raise ForbiddenException("Not authorized to update this booking")
        if booking.status != "pending_payment":
            raise BadRequestException("Only pending bookings can be edited")

        if data.preferred_date is not None:
            if data.preferred_date < _today_nairobi():
                raise BadRequestException("Tour date must be in the future")
            booking.preferred_date = data.preferred_date
        if data.preferred_time is not None:
            booking.preferred_time = data.preferred_time
        if data.phone is not None:
            if len(re.sub(r"\D", "", data.phone)) < 7:
                raise BadRequestException("Please enter a valid phone number")
            booking.phone = data.phone.strip()
        booking.updated_at = datetime.now(timezone.utc)
        await db.flush()

        pushes: List[PushMessage] = []
        if agent_user := await TourService._agent_user_id(db, booking.agent_id):
            pushes.append(PushMessage(
                agent_user, "Tour booking edited",
                "A student updated their tour booking details. Check your dashboard.", "/dashboard/tours",
            ))
        return booking, pushes

    @staticmethod
    async def delete_booking(db: AsyncSession, user: AuthenticatedUser, booking_id: str) -> None:
        """Permanently remove a booking. The booking's agent or an admin only."""
        booking = await TourService._load(db, booking_id)
        if not (user.is_admin or await TourService._is_booking_agent(db, user, booking)):
            raise ForbiddenException("Not authorized to delete this booking")
        await db.delete(booking)
        await db.flush()
