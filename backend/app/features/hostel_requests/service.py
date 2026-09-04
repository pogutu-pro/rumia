"""Service layer for the "Find Me a Hostel" hostel requests feature."""

import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, ForbiddenException, NotFoundException
from app.core.security import AuthenticatedUser
from app.features.hostel_requests.models import HostelRequest
from app.features.hostel_requests.schemas import (
    BUDGET_RANGES,
    FURNISHINGS,
    GENDERS,
    ROOM_TYPES,
    STAY_PREFERENCES,
    HostelRequestCreate,
    HostelRequestFormConfig,
    HostelRequestUpdate,
    HostelRequestZoneOption,
)

DEFAULT_FEE = 100
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
                WHERE id = :user_id::uuid
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
                "SELECT name, COALESCE(hostel_finding_fee, :default) AS fee FROM public.campuses WHERE id = :campus_id::uuid"
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
                WHERE campus_id = :campus_id::uuid
                ORDER BY name ASC
                """
            ),
            {"campus_id": campus_id},
        )
        rows = result.fetchall()
        return [HostelRequestZoneOption(id=str(r.id), name=r.name) for r in rows]

    @staticmethod
    async def _notify_campus_managers(
        db: AsyncSession, campus_id: str, student_name: str, zone: Optional[str], campus_name: str, request_id: str
    ) -> None:
        """Best-effort: insert in-app notifications for the campus managers."""
        try:
            result = await db.execute(
                text(
                    """
                    SELECT id::text AS id FROM public.profiles
                    WHERE role = 'manager' AND managed_campus_id = :campus_id::uuid
                    """
                ),
                {"campus_id": campus_id},
            )
            manager_ids = [str(r.id) for r in result.fetchall()]

            if not manager_ids:
                result = await db.execute(
                    text(
                        """
                        SELECT c.region_id::text FROM public.campuses c
                        WHERE c.id = :campus_id::uuid
                        """
                    ),
                    {"campus_id": campus_id},
                )
                region_row = result.fetchone()
                if region_row and region_row.region_id:
                    result = await db.execute(
                        text(
                            """
                            SELECT id::text FROM public.profiles
                            WHERE role = 'manager' AND managed_region_id = :region_id::uuid
                            """
                        ),
                        {"region_id": region_row.region_id},
                    )
                    manager_ids = [str(r.id) for r in result.fetchall()]

            if not manager_ids:
                result = await db.execute(
                    text("SELECT id::text FROM public.profiles WHERE role = 'admin'")
                )
                manager_ids = [str(r.id) for r in result.fetchall()]

            if not manager_ids:
                return

            title = "New hostel request"
            body = (
                f"{student_name} needs help finding a hostel near {campus_name} "
                f"({zone or 'any area'}). Tap to review."
            )
            for manager_id in manager_ids:
                await db.execute(
                    text(
                        """
                        INSERT INTO public.app_notifications (id, user_id, title, body, url, is_read)
                        VALUES (:id::uuid, :user_id::uuid, :title, :body, :url, false)
                        """
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "user_id": manager_id,
                        "title": title,
                        "body": body,
                        "url": f"/hostel-requests/{request_id}",
                    },
                )
        except Exception:
            # Manager notifications are best-effort and must never block a request.
            pass

    @staticmethod
    async def create_request(
        db: AsyncSession, user: AuthenticatedUser, data: HostelRequestCreate
    ) -> HostelRequest:
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

        await HostelRequestService._notify_campus_managers(
            db, campus_id, request.student_name, request.preferred_zone, campus_name or "your campus", request.id
        )
        return request

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