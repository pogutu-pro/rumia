"""Service layer for the "Find Me a Hostel" hostel requests feature."""

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, ForbiddenException, NotFoundException
from app.core.security import AuthenticatedUser, check_campus_scope
from app.features.campuses.models import Campus
from app.features.hostel_requests.models import HostelRequest
from app.features.hostel_requests.schemas import (
    BUDGET_RANGES,
    FURNISHINGS,
    GENDERS,
    ROOM_TYPES,
    STAY_PREFERENCES,
    HostelRequestCampus,
    HostelRequestCreate,
    HostelRequestFormConfig,
    ManagedHostelRequestRead,
    HostelRequestUpdate,
    HostelRequestZoneOption,
)

DEFAULT_FEE = 100
STATUS_LABELS = {
    "waiting": "Waiting",
    "contacted": "Contacted",
    "finding": "Finding a Hostel",
    "hostel_found": "Hostel Found",
    "completed": "Completed",
    "cancelled": "Cancelled",
}


@dataclass
class PushMessage:
    user_id: str
    title: str
    body: str
    url: str

EDITABLE_STATUSES = ("waiting", "contacted")

_PHONE_RE = re.compile(r"^(?:\+?254|0)([17]\d{8})$")


def clean_kenyan_phone(value: str) -> str:
    """Normalize a phone number to E.164 (+254...) or raise a helpful error."""
    digits = re.sub(r"\D", "", value or "")
    if _PHONE_RE.match(digits) is None:
        raise BadRequestException(
            "Please enter a valid Kenyan phone number starting with 07, 01, +2547 or +2541."
        )

    local = _PHONE_RE.match(digits).group(1)
    return f"+254{local}"


class HostelRequestService:
    @staticmethod
    async def _get_profile(db: AsyncSession, user_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Return (full_name, phone, campus_id) for a user, resolving campus preference."""
        result = await db.execute(
            text(
                """
                SELECT full_name, phone, COALESCE(home_campus_id, campus_id) AS campus_id
                FROM public.profiles
                WHERE id = CAST(:user_id AS uuid)
                """
            ),
            {"user_id": user_id},
        )
        row = result.fetchone()
        if row is None:
            return None, None, None
        return row.full_name, row.phone, str(row.campus_id) if row.campus_id else None

    @staticmethod
    async def _get_campus(db: AsyncSession, campus_id: str) -> Tuple[Optional[str], int]:
        result = await db.execute(
            text(
                "SELECT name, COALESCE(hostel_finding_fee, :default) AS fee FROM public.campuses WHERE id = CAST(:campus_id AS uuid)"
            ),
            {"campus_id": campus_id, "default": DEFAULT_FEE},
        )
        row = result.fetchone()
        if row is None:
            return None, DEFAULT_FEE
        return row.name, int(row.fee or DEFAULT_FEE)

    @staticmethod
    async def _get_campus_zones(db: AsyncSession, campus_id: str) -> List[HostelRequestZoneOption]:
        result = await db.execute(
            text(
                """
                SELECT id::text AS id, name
                FROM public.campus_zones
                WHERE campus_id = CAST(:campus_id AS uuid)
                ORDER BY name ASC
                """
            ),
            {"campus_id": campus_id},
        )
        rows = result.fetchall()
        return [HostelRequestZoneOption(id=str(r.id), name=r.name) for r in rows]

    @staticmethod
    async def manager_user_ids(db: AsyncSession, campus_id: str) -> List[str]:
        """Who to alert about a campus's requests: its campus managers plus the managers of its
        region; admins when nobody manages it."""
        ids = set()
        res = await db.execute(
            text("SELECT id::text AS id FROM public.profiles WHERE role = 'manager' AND managed_campus_id = CAST(:c AS uuid)"),
            {"c": campus_id},
        )
        ids.update(str(r.id) for r in res.fetchall())
        res = await db.execute(
            text("SELECT region_id::text AS region_id FROM public.campuses WHERE id = CAST(:c AS uuid)"),
            {"c": campus_id},
        )
        region = res.fetchone()
        if region and region.region_id:
            res = await db.execute(
                text("SELECT id::text AS id FROM public.profiles WHERE role = 'manager' AND managed_region_id = CAST(:r AS uuid)"),
                {"r": region.region_id},
            )
            ids.update(str(r.id) for r in res.fetchall())
        if not ids:
            res = await db.execute(text("SELECT id::text AS id FROM public.profiles WHERE role = 'admin'"))
            ids.update(str(r.id) for r in res.fetchall())
        return sorted(ids)

    # ── Manager side ────────────────────────────────────────────────────────

    @staticmethod
    async def _allowed_campus_ids(db: AsyncSession, user: AuthenticatedUser) -> Optional[List[str]]:
        """None = all campuses (admin); otherwise the campuses this manager may see."""
        if user.is_admin:
            return None
        if user.managed_campus_id:
            return [user.managed_campus_id]
        if user.managed_region_id:
            res = await db.execute(
                text("SELECT id::text AS id FROM public.campuses WHERE region_id = CAST(:r AS uuid)"),
                {"r": user.managed_region_id},
            )
            return [str(r.id) for r in res.fetchall()]
        return []

    @staticmethod
    async def _with_campus(db: AsyncSession, requests: List[HostelRequest]) -> List[ManagedHostelRequestRead]:
        campus_ids = sorted({str(r.campus_id) for r in requests})
        campuses = {}
        if campus_ids:
            res = await db.execute(select(Campus).where(Campus.id.in_(campus_ids)))
            campuses = {str(c.id): c for c in res.scalars().all()}
        out = []
        for r in requests:
            row = ManagedHostelRequestRead.model_validate(r)
            campus = campuses.get(str(r.campus_id))
            if campus:
                row.campus = HostelRequestCampus(id=str(campus.id), name=campus.name, slug=campus.slug)
                row.campus_name = campus.name
            out.append(row)
        return out

    @staticmethod
    async def list_managed(db: AsyncSession, user: AuthenticatedUser) -> List[ManagedHostelRequestRead]:
        allowed = await HostelRequestService._allowed_campus_ids(db, user)
        if allowed is not None and not allowed:
            return []
        stmt = select(HostelRequest).order_by(HostelRequest.created_at.desc())
        if allowed is not None:
            stmt = stmt.where(HostelRequest.campus_id.in_(allowed))
        res = await db.execute(stmt)
        return await HostelRequestService._with_campus(db, list(res.scalars().all()))

    @staticmethod
    async def get_managed(db: AsyncSession, user: AuthenticatedUser, request_id: str) -> ManagedHostelRequestRead:
        res = await db.execute(select(HostelRequest).where(HostelRequest.id == request_id))
        request = res.scalar_one_or_none()
        # Out-of-scope requests look identical to missing ones.
        if request is None or not await check_campus_scope(user, str(request.campus_id), db):
            raise NotFoundException(f"Hostel request '{request_id}' not found.")
        return (await HostelRequestService._with_campus(db, [request]))[0]

    @staticmethod
    async def update_status(
        db: AsyncSession, user: AuthenticatedUser, request_id: str, new_status: str
    ) -> Tuple[HostelRequest, Optional[PushMessage]]:
        res = await db.execute(select(HostelRequest).where(HostelRequest.id == request_id))
        request = res.scalar_one_or_none()
        if request is None:
            raise NotFoundException(f"Hostel request '{request_id}' not found.")
        if not await check_campus_scope(user, str(request.campus_id), db):
            raise ForbiddenException("You cannot update requests outside your campus")
        request.status = new_status
        request.updated_at = datetime.now(timezone.utc)
        await db.flush()
        label = STATUS_LABELS.get(new_status, new_status)
        push = PushMessage(
            str(request.user_id), "Hostel request update",
            f"Your hostel request status is now: {label}. Check your account for details.",
            "/account?tab=overview",
        ) if request.user_id else None
        return request, push

    @staticmethod
    async def create_request(
        db: AsyncSession, user: AuthenticatedUser, data: HostelRequestCreate
    ) -> Tuple[HostelRequest, List[PushMessage]]:
        phone = clean_kenyan_phone(data.phone)

        student_name, _, campus_id = await HostelRequestService._get_profile(db, user.id)
        if not campus_id:
            raise BadRequestException("Please complete your campus details in your profile first.")

        campus_name, fee = await HostelRequestService._get_campus(db, campus_id)

        now = datetime.now(timezone.utc)
        request = HostelRequest(
            id=str(uuid.uuid4()),
            user_id=user.id,
            student_name=(student_name or "Student"),
            phone=phone,
            campus_id=campus_id,
            preferred_zone=(data.preferred_zone or "").strip() or None,
            budget_range=data.budget_range,
            gender=data.gender,
            room_type=data.room_type,
            furnishing=data.furnishing,
            stay_preference=data.stay_preference,
            move_in_date=data.move_in_date,
            additional_requirements=(data.additional_requirements or "").strip() or None,
            status="waiting",
            fee=fee,
            created_at=now,
            updated_at=now,
        )
        db.add(request)
        await db.flush()

        title = "New hostel request"
        body = (
            f"{request.student_name} needs help finding a hostel near {campus_name or 'your campus'} "
            f"({request.preferred_zone or 'any area'}). Tap to review."
        )
        pushes = [
            PushMessage(manager_id, title, body, "/manager/requests")
            for manager_id in await HostelRequestService.manager_user_ids(db, campus_id)
        ]
        return request, pushes

    @staticmethod
    async def list_my_requests(db: AsyncSession, user: AuthenticatedUser) -> List[HostelRequest]:
        result = await db.execute(
            select(HostelRequest)
            .where(HostelRequest.user_id == user.id)
            .order_by(HostelRequest.created_at.desc())
            .limit(50)
        )
        return list(result.scalars().all())

    @staticmethod
    async def _get_owned_request(db: AsyncSession, user: AuthenticatedUser, request_id: str) -> HostelRequest:
        result = await db.execute(
            select(HostelRequest).where(HostelRequest.id == request_id, HostelRequest.user_id == user.id)
        )
        request = result.scalar_one_or_none()
        if request is None:
            raise NotFoundException(f"Hostel request '{request_id}' not found.")
        return request

    @staticmethod
    async def update_request(
        db: AsyncSession, user: AuthenticatedUser, request_id: str, data: HostelRequestUpdate
    ) -> HostelRequest:
        request = await HostelRequestService._get_owned_request(db, user, request_id)
        if request.status not in EDITABLE_STATUSES:
            raise BadRequestException(
                "This request is already being processed and can no longer be edited."
            )

        if data.phone is not None:
            request.phone = clean_kenyan_phone(data.phone)
        if data.budget_range is not None:
            request.budget_range = data.budget_range
        if data.preferred_zone is not None:
            request.preferred_zone = data.preferred_zone.strip() or None
        if data.gender is not None:
            request.gender = data.gender
        if data.room_type is not None:
            request.room_type = data.room_type
        if data.furnishing is not None:
            request.furnishing = data.furnishing
        if data.stay_preference is not None:
            request.stay_preference = data.stay_preference
        if data.move_in_date is not None:
            request.move_in_date = data.move_in_date
        if data.additional_requirements is not None:
            request.additional_requirements = data.additional_requirements.strip() or None

        request.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return request

    @staticmethod
    async def cancel_request(db: AsyncSession, user: AuthenticatedUser, request_id: str) -> HostelRequest:
        request = await HostelRequestService._get_owned_request(db, user, request_id)
        if request.status not in EDITABLE_STATUSES:
            raise BadRequestException("This request can no longer be cancelled.")
        request.status = "cancelled"
        request.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return request

    @staticmethod
    async def delete_request(db: AsyncSession, user: AuthenticatedUser, request_id: str) -> None:
        request = await HostelRequestService._get_owned_request(db, user, request_id)
        if request.status != "cancelled":
            raise BadRequestException("Only cancelled requests can be removed.")
        await db.delete(request)
        await db.flush()

    @staticmethod
    async def get_form_config(db: AsyncSession, user: AuthenticatedUser) -> HostelRequestFormConfig:
        _, _, campus_id = await HostelRequestService._get_profile(db, user.id)
        if not campus_id:
            return HostelRequestFormConfig(has_campus=False, fee=DEFAULT_FEE, zones=[])

        campus_name, fee = await HostelRequestService._get_campus(db, campus_id)
        zones = await HostelRequestService._get_campus_zones(db, campus_id)
        return HostelRequestFormConfig(
            has_campus=True,
            campus_id=campus_id,
            campus_name=campus_name or "your campus",
            fee=fee,
            zones=zones,
        )