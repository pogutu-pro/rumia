import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.core.scope import allowed_campus_ids, require_campus_scope
from app.core.security import AuthenticatedUser, check_campus_scope
from app.core.slug import slugify, unique_slug
from app.features.agents.models import AgentApplication, AgentProfile
from app.features.campuses.models import Campus
from app.features.hostel_requests.models import HostelRequest
from app.features.hostel_requests.schemas import HostelRequestCampus
from app.features.hostel_requests.service import clean_kenyan_phone
from app.features.leads.models import Lead
from app.features.listings.models import Listing, ListingImage
from app.features.manager.schemas import (
    FoundUser,
    ManagedAgentRead,
    ManagedAnnouncementRead,
    ManagedApplicationRead,
    ManagedListingAgent,
    ManagedListingImage,
    ManagedListingRead,
    ManagerContext,
    ManagerOverview,
    PromotableAgent,
    StaffMember,
)
from app.features.official_hostels.models import OfficialHostel
from app.features.profiles.models import UserProfile


@dataclass
class PushMessage:
    user_id: str
    title: str
    body: str
    url: str


def _lenient_phone(value: str) -> str:
    """Normalise to +254… when it is a valid Kenyan number, otherwise keep what was submitted."""
    try:
        return clean_kenyan_phone(value)
    except BadRequestException:
        return (value or "").strip()


async def _campus_briefs(db: AsyncSession, campus_ids: List[Optional[str]]) -> dict:
    ids = sorted({str(c) for c in campus_ids if c})
    if not ids:
        return {}
    res = await db.execute(select(Campus).where(Campus.id.in_(ids)))
    return {
        str(c.id): HostelRequestCampus(id=str(c.id), name=c.name, slug=c.slug) for c in res.scalars().all()
    }


class ManagerService:
    # ── Context & overview ─────────────────────────────────────────────────

    @staticmethod
    async def context(db: AsyncSession, user: AuthenticatedUser) -> ManagerContext:
        campus_name = "All Campuses"
        if user.managed_campus_id:
            res = await db.execute(select(Campus.name).where(Campus.id == user.managed_campus_id))
            campus_name = res.scalar_one_or_none() or campus_name
        elif not user.is_admin:
            campus_name = "Unassigned Campus"
        prof = await db.execute(select(UserProfile.full_name).where(UserProfile.id == user.id))
        full_name = prof.scalar_one_or_none()
        agent = await db.execute(select(AgentProfile.id).where(AgentProfile.user_id == user.id).limit(1))
        return ManagerContext(
            user_id=user.id,
            role=user.role,
            is_super_admin=user.is_admin,
            managed_campus_id=user.managed_campus_id,
            managed_region_id=user.managed_region_id,
            campus_name=campus_name,
            user_name=full_name or user.email or "",
            user_email=user.email,
            has_agent_record=agent.scalar_one_or_none() is not None,
        )

    @staticmethod
    async def overview(db: AsyncSession, user: AuthenticatedUser) -> ManagerOverview:
        allowed = await allowed_campus_ids(db, user)
        if allowed is not None and not allowed:
            return ManagerOverview(
                has_campuses=False, pending_applications=0, agents=0, listings=0,
                waiting_hostel_requests=0, official_hostels=0,
            )

        async def count(model_id, *conds) -> int:
            return int((await db.execute(select(func.count(model_id)).where(*conds))).scalar_one() or 0)

        def scoped(col):
            return [col.in_(allowed)] if allowed is not None else []

        return ManagerOverview(
            has_campuses=True,
            pending_applications=await count(
                AgentApplication.id, AgentApplication.status == "pending", *scoped(AgentApplication.campus_id)),
            agents=await count(AgentProfile.id, *scoped(AgentProfile.campus_id)),
            listings=await count(Listing.id, *scoped(Listing.campus_id)),
            waiting_hostel_requests=await count(
                HostelRequest.id, HostelRequest.status == "waiting", *scoped(HostelRequest.campus_id)),
            official_hostels=await count(OfficialHostel.id),
        )

    @staticmethod
    async def campuses(db: AsyncSession, user: AuthenticatedUser) -> List[Campus]:
        allowed = await allowed_campus_ids(db, user)
        stmt = select(Campus).order_by(Campus.name.asc())
        if allowed is not None:
            if not allowed:
                return []
            stmt = stmt.where(Campus.id.in_(allowed))
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def list_announcements(db: AsyncSession, user: AuthenticatedUser) -> List[ManagedAnnouncementRead]:
        from app.features.announcements.service import AnnouncementService

        rows = await AnnouncementService.list_managed(db, user)
        briefs = await _campus_briefs(db, [a.campus_id for a in rows])
        return [
            ManagedAnnouncementRead(
                id=str(a.id), campus_id=str(a.campus_id), title=a.title, message=a.message, type=a.type,
                created_by=str(a.created_by) if a.created_by else None, created_at=a.created_at,
                updated_at=a.updated_at, expires_at=a.expires_at, campus=briefs.get(str(a.campus_id)),
            )
            for a in rows
        ]

    # ── Applications ────────────────────────────────────────────────────────

    @staticmethod
    async def list_applications(db: AsyncSession, user: AuthenticatedUser) -> List[ManagedApplicationRead]:
        allowed = await allowed_campus_ids(db, user)
        if allowed is not None and not allowed:
            return []
        stmt = select(AgentApplication).order_by(AgentApplication.created_at.desc())
        if allowed is not None:
            stmt = stmt.where(AgentApplication.campus_id.in_(allowed))
        apps = list((await db.execute(stmt)).scalars().all())
        briefs = await _campus_briefs(db, [a.campus_id for a in apps])
        out = []
        for a in apps:
            row = ManagedApplicationRead.model_validate(a)
            row.campus = briefs.get(str(a.campus_id))
            out.append(row)
        return out

    @staticmethod
    async def _load_pending_application(
        db: AsyncSession, user: AuthenticatedUser, application_id: str, verb: str
    ) -> AgentApplication:
        res = await db.execute(select(AgentApplication).where(AgentApplication.id == application_id))
        app = res.scalar_one_or_none()
        if app is None:
            raise NotFoundException("Application not found")
        if app.status != "pending":
            raise ConflictException(code="ALREADY_PROCESSED", message="Application has already been processed")
        await require_campus_scope(
            db, user, str(app.campus_id), f"You cannot {verb} applications for a campus you do not manage"
        )
        return app

    @staticmethod
    async def approve_application(
        db: AsyncSession, user: AuthenticatedUser, application_id: str
    ) -> Tuple[AgentApplication, PushMessage]:
        """Approve: create the agent record, promote the applicant to role 'agent' (never higher),
        and mark the application approved: all in one transaction."""
        app = await ManagerService._load_pending_application(db, user, application_id, "approve")

        existing = await db.execute(select(AgentProfile.id).where(AgentProfile.user_id == app.user_id).limit(1))
        if existing.scalar_one_or_none():
            raise ConflictException(code="ALREADY_AGENT", message="This user already has an agent profile")

        async def taken(slug: str) -> bool:
            res = await db.execute(select(AgentProfile.id).where(AgentProfile.slug == slug).limit(1))
            return res.scalar_one_or_none() is not None

        slug = await unique_slug(slugify(app.full_name) or "agent", taken)
        phone = _lenient_phone(app.phone)
        db.add(AgentProfile(
            id=str(uuid.uuid4()), user_id=app.user_id, campus_id=app.campus_id, name=app.full_name,
            phone=phone, whatsapp=phone, status="active", slug=slug, commission_balance=0,
            created_at=datetime.now(timezone.utc),
        ))
        profile = (await db.execute(select(UserProfile).where(UserProfile.id == app.user_id))).scalar_one_or_none()
        if profile is not None:
            profile.role = "agent"  # strict boundary: an approval only ever grants 'agent'
        app.status = "approved"
        app.reviewed_by = user.id
        app.reviewed_at = datetime.now(timezone.utc)
        await db.flush()
        return app, PushMessage(
            str(app.user_id), "Agent Application Approved!",
            f"Congratulations! Your application to become a Rumia agent for {app.hostel_name} has been approved.",
            "/dashboard",
        )

    @staticmethod
    async def reject_application(
        db: AsyncSession, user: AuthenticatedUser, application_id: str, reason: str
    ) -> Tuple[AgentApplication, PushMessage]:
        reason = (reason or "").strip()
        if not reason:
            raise BadRequestException("Rejection reason is required")
        app = await ManagerService._load_pending_application(db, user, application_id, "reject")
        app.status = "rejected"
        app.rejection_reason = reason
        app.reviewed_by = user.id
        app.reviewed_at = datetime.now(timezone.utc)
        await db.flush()
        return app, PushMessage(
            str(app.user_id), "Agent Application Status Update",
            f"Your agent application for {app.hostel_name} was not approved. Reason: {reason}",
            "/account?tab=agent-application",
        )

    # ── Agents ──────────────────────────────────────────────────────────────

    @staticmethod
    async def list_agents(db: AsyncSession, user: AuthenticatedUser) -> List[ManagedAgentRead]:
        allowed = await allowed_campus_ids(db, user)
        if allowed is not None and not allowed:
            return []
        stmt = select(AgentProfile).order_by(AgentProfile.created_at.desc())
        if allowed is not None:
            stmt = stmt.where(AgentProfile.campus_id.in_(allowed))
        agents = list((await db.execute(stmt)).scalars().all())
        briefs = await _campus_briefs(db, [a.campus_id for a in agents])
        out = []
        for a in agents:
            row = ManagedAgentRead.model_validate(a)
            row.campus = briefs.get(str(a.campus_id))
            out.append(row)
        return out

    @staticmethod
    async def set_agent_standing(
        db: AsyncSession, user: AuthenticatedUser, agent_id: str, status: str, reason: Optional[str]
    ) -> Tuple[AgentProfile, Optional[PushMessage]]:
        """Suspend/reinstate an agent. Touches ONLY status and suspension_reason (never role,
        campus or verification)."""
        if status == "suspended" and not (reason or "").strip():
            raise BadRequestException("A suspension reason is required.")
        agent = (await db.execute(select(AgentProfile).where(AgentProfile.id == agent_id))).scalar_one_or_none()
        if agent is None:
            raise NotFoundException("Agent not found")
        await require_campus_scope(
            db, user, str(agent.campus_id) if agent.campus_id else None,
            "You cannot modify agent standing outside your campus",
        )
        agent.status = status
        agent.suspension_reason = reason.strip() if status == "suspended" and reason else None
        await db.flush()
        push = None
        if agent.user_id:
            push = PushMessage(
                str(agent.user_id), "Account Standing Update",
                "Your agent account standing has been reinstated by your campus manager."
                if status == "active" else f"Your account has been suspended: {reason}",
                "/dashboard",
            )
        return agent, push

    # ── Listings ────────────────────────────────────────────────────────────

    @staticmethod
    async def list_listings(db: AsyncSession, user: AuthenticatedUser) -> List[ManagedListingRead]:
        allowed = await allowed_campus_ids(db, user)
        if allowed is not None and not allowed:
            return []
        stmt = select(Listing).order_by(Listing.created_at.desc())
        if allowed is not None:
            stmt = stmt.where(Listing.campus_id.in_(allowed))
        listings = list((await db.execute(stmt)).scalars().all())
        briefs = await _campus_briefs(db, [l.campus_id for l in listings])
        counts = {}
        if listings:
            res = await db.execute(
                select(Lead.listing_id, func.count(Lead.id)).where(Lead.listing_id.in_([l.id for l in listings]))
                .group_by(Lead.listing_id)
            )
            counts = {str(lid): int(n) for lid, n in res.all()}
        out = []
        for l in listings:
            out.append(ManagedListingRead(
                id=str(l.id), slug=l.slug, title=l.title, price=float(l.price), location=l.location,
                area=l.area, county=l.county, campus_id=str(l.campus_id) if l.campus_id else None,
                is_active=bool(l.is_active), verified=bool(l.verified), pays_commission=bool(l.pays_commission),
                commission_locked_by_admin=bool(l.commission_locked_by_admin), landlord_phone=l.landlord_phone,
                created_at=l.created_at,
                images=[ManagedListingImage(r2_url=i.r2_url, display_order=i.display_order) for i in (l.images or [])],
                agent=ManagedListingAgent(id=str(l.agent.id), name=l.agent.name, user_id=str(l.agent.user_id) if l.agent.user_id else None) if l.agent else None,
                lead_count=counts.get(str(l.id), 0), campus=briefs.get(str(l.campus_id)),
            ))
        return out

    @staticmethod
    async def get_managed_listing(db: AsyncSession, user: AuthenticatedUser, listing_id: str) -> Listing:
        """A listing for the edit form: 404 (never 403) when it is missing or outside the manager's scope."""
        from app.features.listings.service import ListingService

        listing = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        if listing is None or not listing.campus_id or not await check_campus_scope(user, str(listing.campus_id), db):
            raise NotFoundException("Listing not found.")
        return listing

    @staticmethod
    async def hostels_overview(db: AsyncSession, user: AuthenticatedUser):
        """Official records + the in-scope listings, for cross-checking."""
        from app.features.official_hostels.service import OfficialHostelService

        overview = await OfficialHostelService.overview(db)
        allowed = await allowed_campus_ids(db, user)
        if allowed is None:
            return overview
        scoped_ids = set()
        if allowed:
            res = await db.execute(select(Listing.id).where(Listing.campus_id.in_(allowed)))
            scoped_ids = {str(i) for i in res.scalars().all()}
        overview.listings = [l for l in overview.listings if l.id in scoped_ids]
        return overview

    @staticmethod
    async def set_owner_phone(
        db: AsyncSession, user: AuthenticatedUser, listing_id: str, phone: Optional[str]
    ) -> Listing:
        cleaned = (phone or "").strip()
        if cleaned:
            try:
                clean_kenyan_phone(cleaned)
            except BadRequestException:
                raise BadRequestException("Please enter a valid Kenyan owner phone number.")
        listing = (await db.execute(select(Listing).where(Listing.id == listing_id))).scalar_one_or_none()
        if listing is None:
            raise NotFoundException("Listing not found.")
        await require_campus_scope(
            db, user, str(listing.campus_id) if listing.campus_id else None,
            "You cannot modify listings outside your campus.",
        )
        listing.landlord_phone = cleaned or None
        await db.flush()
        return listing

    # ── Campus settings ─────────────────────────────────────────────────────

    MANAGER_CAMPUS_FIELDS = (
        "phone", "email", "social_links", "whatsapp_number", "hero_headline", "hero_subtext", "primary_color",
        "short_name", "hero_image", "seo_title", "seo_description", "og_title", "og_description",
        "twitter_description", "hostel_finding_fee", "consultation_fee",
    )
    ADMIN_CAMPUS_FIELDS = ("name", "slug", "region_id", "status")

    @staticmethod
    async def update_campus_settings(
        db: AsyncSession, user: AuthenticatedUser, campus_id: str, data
    ) -> Campus:
        """Managers edit contact/branding/fee fields of campuses they manage, once it has at least
        one hostel area (agents pick from these when listing). Admins may also rename/re-slug/
        re-region/change status."""
        await require_campus_scope(db, user, campus_id, "You cannot modify settings for a campus you do not manage")
        campus = (await db.execute(select(Campus).where(Campus.id == campus_id))).scalar_one_or_none()
        if campus is None:
            raise NotFoundException("Campus not found")

        from app.features.zones.models import CampusZone

        zones = (await db.execute(select(func.count(CampusZone.id)).where(CampusZone.campus_id == campus_id))).scalar_one()
        if not zones:
            raise BadRequestException(
                "Add at least one hostel area (zone) before completing campus settings. "
                "Agents select these areas when listing hostels."
            )
        fields = ManagerService.MANAGER_CAMPUS_FIELDS + (ManagerService.ADMIN_CAMPUS_FIELDS if user.is_admin else ())
        for field in data.model_fields_set:
            if field in fields:
                setattr(campus, field, getattr(data, field))
        await db.flush()
        return campus

    @staticmethod
    async def create_campus(db: AsyncSession, user: AuthenticatedUser, data) -> Campus:
        """Admin only. New campuses start as 'coming_soon' with placeholder branding."""
        ManagerService._require_admin(user)
        slug = (data.slug or "").strip().lower() or re.sub(r"[^a-z0-9]+", "-", data.name.lower()).strip("-")[:50]
        if not slug:
            raise BadRequestException("Campus name must contain letters or numbers.")
        taken = await db.execute(select(Campus.id).where(Campus.slug == slug).limit(1))
        if taken.scalar_one_or_none():
            raise ConflictException(code="SLUG_TAKEN", message=f"A campus with the slug '{slug}' already exists")
        campus = Campus(
            id=str(uuid.uuid4()), slug=slug, name=data.name.strip(), city="", status="coming_soon",
            hero_headline=f"Student Hostels Near {data.name.strip()}", whatsapp_number="+254114845619",
            primary_color="#10B981", feature_flags={}, region_id=data.region_id or None,
            hero_image=data.hero_image, created_at=datetime.now(timezone.utc),
        )
        db.add(campus)
        await db.flush()
        return campus

    # ── Staff (admin only) ──────────────────────────────────────────────────

    @staticmethod
    def _require_admin(user: AuthenticatedUser) -> None:
        if not user.is_admin:
            raise ForbiddenException("Admin role required")

    @staticmethod
    async def list_staff(db: AsyncSession, user: AuthenticatedUser) -> List[StaffMember]:
        ManagerService._require_admin(user)
        res = await db.execute(
            select(UserProfile).where(UserProfile.role.in_(("manager", "admin"))).order_by(UserProfile.created_at.desc())
        )
        return [
            StaffMember(
                id=str(p.id), full_name=p.full_name, email=p.email or "Unknown", role=p.role,
                managed_campus_id=str(p.managed_campus_id) if p.managed_campus_id else None,
                managed_region_id=str(p.managed_region_id) if p.managed_region_id else None,
            )
            for p in res.scalars().all()
        ]

    @staticmethod
    async def assign_manager(
        db: AsyncSession, user: AuthenticatedUser, target_user_id: str,
        campus_id: Optional[str], region_id: Optional[str],
    ) -> UserProfile:
        ManagerService._require_admin(user)
        if campus_id and region_id:
            raise BadRequestException("A manager cannot have both a campus and a region assigned.")
        profile = (await db.execute(select(UserProfile).where(UserProfile.id == target_user_id))).scalar_one_or_none()
        if profile is None:
            raise NotFoundException("User not found")
        profile.role = "manager"
        profile.managed_campus_id = campus_id or None
        profile.managed_region_id = region_id or None
        await db.flush()
        return profile

    @staticmethod
    async def remove_manager(db: AsyncSession, user: AuthenticatedUser, target_user_id: str) -> None:
        """Downgrade a manager back to 'agent' (they were promoted from the agent pool)."""
        ManagerService._require_admin(user)
        if target_user_id == user.id:
            raise BadRequestException("Cannot demote yourself")
        profile = (await db.execute(select(UserProfile).where(UserProfile.id == target_user_id))).scalar_one_or_none()
        if profile is None:
            raise NotFoundException("User not found")
        profile.role = "agent"
        profile.managed_campus_id = None
        profile.managed_region_id = None
        await db.flush()

    @staticmethod
    async def find_user_by_email(db: AsyncSession, user: AuthenticatedUser, email: str) -> FoundUser:
        ManagerService._require_admin(user)
        res = await db.execute(select(UserProfile).where(func.lower(UserProfile.email) == email.strip().lower()))
        profile = res.scalar_one_or_none()
        if profile is None:
            raise NotFoundException("User not found with this email")
        return FoundUser(id=str(profile.id), email=profile.email or "", full_name=profile.full_name or "Unknown")

    @staticmethod
    async def search_agents_to_promote(db: AsyncSession, user: AuthenticatedUser, query: str) -> List[PromotableAgent]:
        """Only accounts that already hold the 'agent' role can be promoted to manager."""
        ManagerService._require_admin(user)
        term = (query or "").strip().lower()
        if len(term) < 2:
            return []
        like = f"%{term}%"
        res = await db.execute(
            select(UserProfile, Campus.name)
            .join(Campus, UserProfile.campus_id == Campus.id, isouter=True)
            .where(UserProfile.role == "agent", or_(UserProfile.email.ilike(like), UserProfile.full_name.ilike(like)))
            .limit(20)
        )
        return [
            PromotableAgent(id=str(p.id), email=p.email or "", full_name=p.full_name or "Unknown",
                            campus_name=campus_name or "Unknown campus")
            for p, campus_name in res.all()
        ]
