"""Admin-only operations behind the admin console (listings, agents, users, commissions, analytics)."""
import uuid
from app.core.permissions import sync_staff_for_role
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.features.catalog.service import project_listing
from app.core.auth_provider import get_auth_provider
from app.core.errors import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.core.security import AuthenticatedUser
from app.core.slug import slugify, unique_slug
from app.features.admin.console_schemas import (
    AdminAgentCommission,
    AdminAgentDetail,
    AdminAgentDetailAgent,
    AdminAgentLead,
    AdminAgentListing,
    AdminAgentRow,
    AdminAnalytics,
    AdminCommissionRow,
    AdminCommissionsPage,
    AdminLeadRow,
    AdminLeadsPage,
    AdminListingRow,
    AdminListingsPage,
    AdminOverview,
    AdminUserRow,
    AgentOption,
    AgentVerificationResult,
    ListingLeadRow,
    ListingLeadsPage,
    ListingVerificationResult,
    SupportAgentRow,
    TitleRef,
    TransferRow,
    VerifyAllSummary,
)
from app.features.admin.models import TransferHistory
from app.features.agents.models import AgentProfile
from app.features.campuses.models import Campus
from app.features.hostel_requests.service import clean_kenyan_phone
from app.features.leads.models import Commission, Lead
from app.features.listings.models import Listing
from app.features.listings.verification import (
    official_records,
    verify_agent,
    verify_listing,
)
from app.features.official_hostels.models import OfficialHostel
from app.features.profiles.models import UserProfile
from app.features.regions.models import Region


@dataclass
class PushMessage:
    user_id: str
    title: str
    body: str
    url: str


def require_admin(user: AuthenticatedUser) -> None:
    if not user.is_admin:
        raise ForbiddenException("Admin role required")


def _normalize_phone(raw: str) -> str:
    """+254… form (lenient: unusable numbers are kept as typed, matching the former web helper)."""
    try:
        return clean_kenyan_phone(raw)
    except BadRequestException:
        cleaned = "".join(ch for ch in raw if ch not in " -()")
        if cleaned.startswith("0") and len(cleaned) > 1:
            return "+254" + cleaned[1:]
        if cleaned.startswith("254") and not cleaned.startswith("+"):
            return "+" + cleaned
        return cleaned if cleaned.startswith("+") else "+254" + cleaned


class AdminConsoleService:
    # ── Overview ───────────────────────────────────────────────────────────

    @staticmethod
    async def overview(db: AsyncSession, user: AuthenticatedUser) -> AdminOverview:
        require_admin(user)
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        async def count(stmt) -> int:
            return int((await db.execute(stmt)).scalar_one() or 0)

        pending = (await db.execute(
            select(func.coalesce(func.sum(Commission.amount), 0)).where(Commission.status == "pending")
        )).scalar_one()
        return AdminOverview(
            active_listings=await count(select(func.count(Listing.id)).where(Listing.is_active.is_(True))),
            monthly_leads=await count(select(func.count(Lead.id)).where(Lead.clicked_at >= month_start)),
            pending_commissions_kes=float(pending or 0),
            active_agents=await count(select(func.count(AgentProfile.id)).where(AgentProfile.status == "active")),
            total_campuses=await count(select(func.count(Campus.id))),
            total_regions=await count(select(func.count(Region.id))),
            total_managers=await count(select(func.count(UserProfile.id)).where(UserProfile.role == "manager")),
            support_agents=await count(select(func.count(AgentProfile.id)).where(AgentProfile.is_support.is_(True))),
            official_hostels=await count(select(func.count(OfficialHostel.id))),
        )

    # ── Users ──────────────────────────────────────────────────────────────

    @staticmethod
    async def list_users(db: AsyncSession, user: AuthenticatedUser) -> List[AdminUserRow]:
        require_admin(user)
        profiles = (await db.execute(select(UserProfile).order_by(UserProfile.created_at.desc()))).scalars().all()
        agents = {
            str(a.user_id): a for a in (await db.execute(select(AgentProfile).where(AgentProfile.user_id.is_not(None)))).scalars().all()
        }
        out = []
        for p in profiles:
            agent = agents.get(str(p.id))
            out.append(AdminUserRow(
                id=str(p.id), email=p.email or "", full_name=p.full_name, avatar_url=p.avatar_url, phone=p.phone,
                role=p.role or "student", created_at=p.created_at, updated_at=p.updated_at,
                has_agent=agent is not None, agent_name=agent.name if agent else None,
                agent_status=agent.status if agent else None, agent_slug=agent.slug if agent else None,
            ))
        return out

    @staticmethod
    async def change_role(db: AsyncSession, user: AuthenticatedUser, target_id: str, role: str) -> None:
        require_admin(user)
        profile = (await db.execute(select(UserProfile).where(UserProfile.id == target_id))).scalar_one_or_none()
        if profile is None:
            raise NotFoundException("User not found")
        profile.role = role
        await db.flush()
        await sync_staff_for_role(db, str(target_id), role)

    @staticmethod
    async def promote_to_admin(db: AsyncSession, user: AuthenticatedUser, target_id: str) -> None:
        require_admin(user)
        if target_id == user.id:
            raise BadRequestException("You are already an admin")
        profile = (await db.execute(select(UserProfile).where(UserProfile.id == target_id))).scalar_one_or_none()
        if profile is None:
            raise NotFoundException("User not found")
        if profile.role == "admin":
            raise ConflictException(code="ALREADY_ADMIN", message="User is already an admin")
        profile.role = "admin"
        profile.managed_campus_id = None
        profile.managed_region_id = None
        await db.flush()
        await sync_staff_for_role(db, str(target_id), "admin")

    # ── Agents ─────────────────────────────────────────────────────────────

    @staticmethod
    async def list_agents(db: AsyncSession, user: AuthenticatedUser) -> List[AdminAgentRow]:
        require_admin(user)
        agents = (await db.execute(select(AgentProfile).order_by(AgentProfile.created_at.desc()))).scalars().all()
        roles = {
            str(r.id): r.role
            for r in (await db.execute(select(UserProfile.id, UserProfile.role).where(
                UserProfile.id.in_([a.user_id for a in agents if a.user_id])))).all()
        } if agents else {}
        active = dict((str(a), n) for a, n in (await db.execute(
            select(Listing.agent_id, func.count(Listing.id)).where(Listing.is_active.is_(True)).group_by(Listing.agent_id))).all())
        leads = dict((str(a), n) for a, n in (await db.execute(
            select(Lead.agent_id, func.count(Lead.id)).group_by(Lead.agent_id))).all())
        pending = dict((str(a), float(n or 0)) for a, n in (await db.execute(
            select(Commission.agent_id, func.sum(Commission.amount)).where(Commission.status == "pending")
            .group_by(Commission.agent_id))).all())
        return [
            AdminAgentRow(
                id=str(a.id), name=a.name, phone=a.phone, whatsapp=a.whatsapp, status=a.status, created_at=a.created_at,
                user_id=str(a.user_id) if a.user_id else "", active_listings_count=int(active.get(str(a.id), 0)),
                total_leads_count=int(leads.get(str(a.id), 0)), pending_commissions_sum=pending.get(str(a.id), 0.0),
                role=roles.get(str(a.user_id), "agent") if a.user_id else "agent",
                is_featured=bool(a.is_featured), is_founder=bool(a.is_founder),
            )
            for a in agents
        ]

    @staticmethod
    async def agent_detail(db: AsyncSession, user: AuthenticatedUser, agent_id: str) -> AdminAgentDetail:
        require_admin(user)
        agent = (await db.execute(select(AgentProfile).where(AgentProfile.id == agent_id))).scalar_one_or_none()
        if agent is None:
            raise NotFoundException("Agent not found")
        role = None
        if agent.user_id:
            role = (await db.execute(select(UserProfile.role).where(UserProfile.id == agent.user_id))).scalar_one_or_none()
        listings = (await db.execute(select(Listing).where(Listing.agent_id == agent.id).order_by(Listing.created_at.desc()))).scalars().all()
        titles = {str(l.id): l.title for l in listings}
        leads = (await db.execute(select(Lead).where(Lead.agent_id == agent.id).order_by(Lead.clicked_at.desc()))).scalars().all()
        commissions = (await db.execute(select(Commission).where(Commission.agent_id == agent.id).order_by(Commission.created_at.desc()))).scalars().all()
        missing = {str(x.listing_id) for x in [*leads, *commissions] if str(x.listing_id) not in titles}
        if missing:
            for lid, title in (await db.execute(select(Listing.id, Listing.title).where(Listing.id.in_(list(missing))))).all():
                titles[str(lid)] = title

        def ref(lid) -> Optional[TitleRef]:
            return TitleRef(id=str(lid), title=titles[str(lid)]) if str(lid) in titles else None

        return AdminAgentDetail(
            agent=AdminAgentDetailAgent(
                id=str(agent.id), name=agent.name, phone=agent.phone, whatsapp=agent.whatsapp, status=agent.status,
                verified=bool(agent.verified), created_at=agent.created_at,
                user_id=str(agent.user_id) if agent.user_id else None, role=role,
            ),
            listings=[AdminAgentListing(id=str(l.id), title=l.title, location=l.location, price=float(l.price), is_active=bool(l.is_active)) for l in listings],
            leads=[AdminAgentLead(id=str(l.id), clicked_at=l.clicked_at, listing_id=str(l.listing_id), listings=ref(l.listing_id)) for l in leads],
            commissions=[AdminAgentCommission(id=str(c.id), amount=float(c.amount), status=c.status, created_at=c.created_at,
                                               paid_at=c.paid_at, listing_id=str(c.listing_id), listings=ref(c.listing_id)) for c in commissions],
        )

    @staticmethod
    async def _unique_agent_slug(db: AsyncSession, name: str) -> str:
        async def taken(slug: str) -> bool:
            return (await db.execute(select(AgentProfile.id).where(AgentProfile.slug == slug).limit(1))).scalar_one_or_none() is not None

        return await unique_slug(slugify(name) or "agent", taken)

    @staticmethod
    async def _agent_campus_id(db: AsyncSession, user_id: str) -> Optional[str]:
        """The user's own campus (so promoted students keep it), else the default campus. agents.campus_id is NOT NULL."""
        row = (await db.execute(select(UserProfile.campus_id, UserProfile.home_campus_id).where(UserProfile.id == user_id))).first()
        if row and (row.campus_id or row.home_campus_id):
            return str(row.campus_id or row.home_campus_id)
        dekut = (await db.execute(select(Campus.id).where(Campus.slug == settings.DEFAULT_CAMPUS_SLUG))).scalar_one_or_none()
        return str(dekut) if dekut else None

    @staticmethod
    def _auto_verified(phone: str, whatsapp: str) -> bool:
        try:
            return verify_agent(phone, whatsapp).verified
        except Exception:
            return False  # best-effort

    @staticmethod
    async def _admin_user_ids(db: AsyncSession) -> List[str]:
        return [str(i) for i in (await db.execute(select(UserProfile.id).where(UserProfile.role == "admin"))).scalars().all()]

    @staticmethod
    async def create_agent(db: AsyncSession, user: AuthenticatedUser, data) -> Tuple[AgentProfile, List[PushMessage]]:
        """Create a login identity AND its agent record; roll the identity back if the record fails."""
        require_admin(user)
        sanitized = "".join(ch for ch in data.phone if ch.isalnum())
        provider = get_auth_provider(db)
        new_user_id = await provider.create_user(f"{sanitized}@agents.rumia.co.ke")
        try:
            phone, whatsapp = _normalize_phone(data.phone), _normalize_phone(data.whatsapp)
            campus_id = await AdminConsoleService._agent_campus_id(db, new_user_id)
            if not campus_id:
                raise BadRequestException("No campus configured yet. Cannot create agent.")
            agent = AgentProfile(
                id=str(uuid.uuid4()), name=data.name.strip(), phone=phone, whatsapp=whatsapp, user_id=new_user_id,
                campus_id=campus_id, status="active", slug=await AdminConsoleService._unique_agent_slug(db, data.name),
                commission_balance=0, verified=AdminConsoleService._auto_verified(phone, whatsapp),
                created_at=datetime.now(timezone.utc),
            )
            db.add(agent)
            await db.flush()
        except Exception:
            await provider.delete_user(new_user_id)
            raise
        pushes = [
            PushMessage(admin_id, "New agent registered", f"{data.name} was just added as an agent.", "/admin/agents")
            for admin_id in await AdminConsoleService._admin_user_ids(db)
        ]
        return agent, pushes

    @staticmethod
    async def promote_student(db: AsyncSession, user: AuthenticatedUser, data) -> AgentProfile:
        """Give an existing user an agent record and the 'agent' role (no new login is created)."""
        require_admin(user)
        profile = (await db.execute(select(UserProfile).where(UserProfile.id == data.user_id))).scalar_one_or_none()
        if profile is None:
            raise NotFoundException("User not found")
        if (await db.execute(select(AgentProfile.id).where(AgentProfile.user_id == data.user_id).limit(1))).scalar_one_or_none():
            raise ConflictException(code="ALREADY_AGENT", message="This user already has an agent profile")
        campus_id = await AdminConsoleService._agent_campus_id(db, data.user_id)
        if not campus_id:
            raise BadRequestException("Cannot determine a campus for this user. Assign a campus to their profile first.")
        phone, whatsapp = _normalize_phone(data.phone), _normalize_phone(data.whatsapp)
        agent = AgentProfile(
            id=str(uuid.uuid4()), name=data.name.strip(), phone=phone, whatsapp=whatsapp, user_id=data.user_id,
            campus_id=campus_id, status="active", slug=await AdminConsoleService._unique_agent_slug(db, data.name),
            commission_balance=0, verified=AdminConsoleService._auto_verified(phone, whatsapp),
            created_at=datetime.now(timezone.utc),
        )
        db.add(agent)
        profile.role = "agent"
        await db.flush()
        return agent

    @staticmethod
    async def _agent(db: AsyncSession, agent_id: str) -> AgentProfile:
        agent = (await db.execute(select(AgentProfile).where(AgentProfile.id == agent_id))).scalar_one_or_none()
        if agent is None:
            raise NotFoundException("Agent not found")
        return agent

    @staticmethod
    async def patch_agent(db: AsyncSession, user: AuthenticatedUser, agent_id: str, data) -> AgentProfile:
        require_admin(user)
        agent = await AdminConsoleService._agent(db, agent_id)
        if not data.model_fields_set:
            raise BadRequestException("No fields to update")
        if data.name is not None:
            agent.name = data.name.strip()
        if data.phone is not None:
            agent.phone = _normalize_phone(data.phone)
        if data.whatsapp is not None:
            agent.whatsapp = _normalize_phone(data.whatsapp)
        await db.flush()
        return agent

    @staticmethod
    async def set_flags(db: AsyncSession, user: AuthenticatedUser, agent_id: str, data) -> AgentProfile:
        require_admin(user)
        agent = await AdminConsoleService._agent(db, agent_id)
        for field in ("is_featured", "is_founder", "verified"):
            value = getattr(data, field)
            if value is not None:
                setattr(agent, field, value)
        await db.flush()
        return agent

    @staticmethod
    async def set_support(db: AsyncSession, user: AuthenticatedUser, agent_id: str, data) -> AgentProfile:
        """Support-team placement. Making someone the owner clears the previous owner (single owner)."""
        require_admin(user)
        agent = await AdminConsoleService._agent(db, agent_id)
        if data.is_owner:
            await db.execute(update(AgentProfile).where(AgentProfile.is_owner.is_(True)).values(is_owner=False))
        for field in ("is_support", "support_rank", "is_owner"):
            value = getattr(data, field)
            if value is not None:
                setattr(agent, field, value)
        await db.flush()
        return agent

    @staticmethod
    async def agent_verification(db: AsyncSession, user: AuthenticatedUser, agent_id: str) -> AgentVerificationResult:
        require_admin(user)
        agent = await AdminConsoleService._agent(db, agent_id)
        match = verify_agent(agent.phone, agent.whatsapp)
        return AgentVerificationResult(
            verified=match.verified, matched_hostels=match.matched_hostels,
            shared_contact_detected=match.shared_contact_detected,
        )

    @staticmethod
    async def list_support_agents(db: AsyncSession, user: AuthenticatedUser) -> List[SupportAgentRow]:
        require_admin(user)
        rows = (await db.execute(select(AgentProfile).order_by(AgentProfile.support_rank.asc(), AgentProfile.name.asc()))).scalars().all()
        return [
            SupportAgentRow(
                id=str(a.id), name=a.name, profile_photo_url=a.profile_photo_url, bio=a.bio, verified=bool(a.verified),
                whatsapp=a.whatsapp, phone=a.phone, slug=a.slug, status=a.status, is_featured=bool(a.is_featured),
                is_founder=bool(a.is_founder), is_support=bool(a.is_support), support_rank=int(a.support_rank or 0),
                is_owner=bool(a.is_owner),
            )
            for a in rows
        ]

    # ── Listings ───────────────────────────────────────────────────────────

    @staticmethod
    async def listings_page(db: AsyncSession, user: AuthenticatedUser) -> AdminListingsPage:
        require_admin(user)
        listings = (await db.execute(
            select(Listing).order_by(Listing.sort_position.asc().nulls_last(), Listing.created_at.desc())
        )).scalars().all()
        agents = (await db.execute(select(AgentProfile).order_by(AgentProfile.name.asc()))).scalars().all()
        lead_counts = dict((str(l), n) for l, n in (await db.execute(
            select(Lead.listing_id, func.count(Lead.id)).group_by(Lead.listing_id))).all())
        last = (await db.execute(text("SELECT max(changed_at) FROM public.listing_sort_history"))).scalar_one_or_none()
        rows = []
        for l in listings:
            images = sorted(l.images or [], key=lambda i: i.display_order)
            agent = l.agent
            rows.append(AdminListingRow(
                id=str(l.id), title=l.title, location=l.location, price=float(l.price), is_active=bool(l.is_active),
                verified=bool(l.verified or (getattr(agent, "verified", None) if agent else False)),
                created_at=l.created_at, sort_position=l.sort_position, leads_count=int(lead_counts.get(str(l.id), 0)),
                agent_name=agent.name if agent else "—", agent_id=str(agent.id) if agent else "",
                cover_image=images[0].r2_url if images else None, landlord_phone=l.landlord_phone,
                pays_commission=True if l.pays_commission is None else bool(l.pays_commission),
                commission_locked_by_admin=bool(l.commission_locked_by_admin),
            ))
        return AdminListingsPage(
            listings=rows,
            agents=[AgentOption(id=str(a.id), name=a.name, status=a.status) for a in agents],
            last_reorder_at=last, has_custom_order=any(r.sort_position is not None for r in rows),
        )

    @staticmethod
    async def reorder(db: AsyncSession, user: AuthenticatedUser, updates) -> None:
        """Atomic set-based reorder + audit rows (the reorder_listings function)."""
        require_admin(user)
        if not updates:
            return
        import json

        await db.execute(
            text("SELECT public.reorder_listings(CAST(:positions AS jsonb), CAST(:admin AS uuid))"),
            {"positions": json.dumps([{"listing_id": u.id, "new_position": u.sort_position} for u in updates]),
             "admin": user.id},
        )

    @staticmethod
    async def shuffle(db: AsyncSession, user: AuthenticatedUser) -> None:
        require_admin(user)
        await db.execute(text("SELECT public.shuffle_listing_order(CAST(:admin AS uuid))"), {"admin": user.id})

    @staticmethod
    async def _listing(db: AsyncSession, listing_id: str) -> Listing:
        listing = (await db.execute(select(Listing).where(Listing.id == listing_id))).scalar_one_or_none()
        if listing is None:
            raise NotFoundException("Listing not found")
        return listing

    @staticmethod
    async def set_commission_lock(db: AsyncSession, user: AuthenticatedUser, listing_id: str, locked: bool) -> Listing:
        require_admin(user)
        listing = await AdminConsoleService._listing(db, listing_id)
        listing.commission_locked_by_admin = locked
        await db.flush()
        return listing

    @staticmethod
    async def set_listing_verified(db: AsyncSession, user: AuthenticatedUser, listing_id: str, verified: bool) -> Listing:
        require_admin(user)
        listing = await AdminConsoleService._listing(db, listing_id)
        listing.verified = verified
        listing.verified_source = "Admin Manual Verification" if verified else None
        listing.verified_date = date.today() if verified else None
        await db.flush()
        await project_listing(db, listing.id)
        return listing

    @staticmethod
    async def verify_listing(db: AsyncSession, user: AuthenticatedUser, listing_id: str) -> ListingVerificationResult:
        """Check one listing against the official records. Only fills fields that are not already set,
        so manual decisions are never silently overwritten."""
        require_admin(user)
        listing = await AdminConsoleService._listing(db, listing_id)
        agent = listing.agent
        result = verify_listing(
            title=listing.title, landlord_phone=listing.landlord_phone,
            agent_phone=agent.phone if agent else None, agent_whatsapp=agent.whatsapp if agent else None,
        )
        if not listing.verified:
            listing.verified = result.verified
        if not listing.verified_source:
            listing.verified_source = result.verified_source
        if not listing.verified_date and result.verified_date:
            listing.verified_date = date.fromisoformat(result.verified_date)
        if not listing.discrepancy_review_needed:
            listing.discrepancy_review_needed = result.discrepancy_review_needed
        if not listing.shared_contact_detected:
            listing.shared_contact_detected = result.shared_contact_detected
        if not listing.manual_review_needed:
            listing.manual_review_needed = result.manual_review_needed
        await db.flush()
        await project_listing(db, listing.id)
        return ListingVerificationResult(
            verified=result.verified, match_type=result.match_type, matched_hostel=result.matched_hostel, flags=result.flags,
        )

    @staticmethod
    async def verify_all(db: AsyncSession, user: AuthenticatedUser) -> VerifyAllSummary:
        """Re-run verification for every active listing and overwrite its verification fields."""
        require_admin(user)
        listings = (await db.execute(select(Listing).where(Listing.is_active.is_(True)))).scalars().all()
        phone_verified = name_review = no_match = shared = 0
        matched_records = set()
        for listing in listings:
            agent = listing.agent
            result = verify_listing(
                title=listing.title, landlord_phone=listing.landlord_phone,
                agent_phone=agent.phone if agent else None, agent_whatsapp=agent.whatsapp if agent else None,
            )
            listing.verified = result.verified
            listing.verified_source = result.verified_source
            listing.verified_date = date.fromisoformat(result.verified_date) if result.verified_date else None
            listing.discrepancy_review_needed = result.discrepancy_review_needed
            listing.shared_contact_detected = result.shared_contact_detected
            listing.manual_review_needed = result.manual_review_needed
            await db.flush()
            await project_listing(db, listing.id)
            if result.matched_hostel:
                matched_records.add(result.matched_hostel)
            if result.verified:
                phone_verified += 1
            elif result.manual_review_needed:
                name_review += 1
            else:
                no_match += 1
            if result.shared_contact_detected:
                shared += 1
        await db.flush()
        official_no_listing = sum(1 for r in official_records() if r.hostel_name not in matched_records)
        return VerifyAllSummary(
            total=len(listings), matched=len(listings) - no_match, phone_verified=phone_verified,
            name_review=name_review, no_match=no_match, shared_contacts=shared, official_no_listing=official_no_listing,
        )

    @staticmethod
    async def listing_leads(db: AsyncSession, user: AuthenticatedUser, listing_id: str) -> ListingLeadsPage:
        require_admin(user)
        listing = await AdminConsoleService._listing(db, listing_id)
        leads = (await db.execute(select(Lead).where(Lead.listing_id == listing.id).order_by(Lead.clicked_at.desc()))).scalars().all()
        ids = {str(l.agent_id) for l in leads if l.agent_id}
        names = {}
        if ids:
            names = {str(i): n for i, n in (await db.execute(select(AgentProfile.id, AgentProfile.name).where(AgentProfile.id.in_(list(ids))))).all()}
        agent = listing.agent
        return ListingLeadsPage(
            listing={"id": str(listing.id), "title": listing.title, "location": listing.location,
                     "agent_id": str(listing.agent_id) if listing.agent_id else None,
                     "agents": {"id": str(agent.id), "name": agent.name} if agent else None},
            leads=[ListingLeadRow(id=str(l.id), name=l.name, phone=l.phone, contact_type=l.contact_type,
                                  clicked_at=l.clicked_at, agent_id=str(l.agent_id) if l.agent_id else None) for l in leads],
            agent_names=names,
        )

    @staticmethod
    async def leads_page(db: AsyncSession, user: AuthenticatedUser) -> AdminLeadsPage:
        require_admin(user)
        leads = (await db.execute(select(Lead).order_by(Lead.clicked_at.desc()))).scalars().all()
        agents = (await db.execute(select(AgentProfile.id, AgentProfile.name).order_by(AgentProfile.name.asc()))).all()
        listings = (await db.execute(select(Listing.id, Listing.title).order_by(Listing.title.asc()))).all()
        a_map = {str(i): n for i, n in agents}
        l_map = {str(i): t for i, t in listings}
        return AdminLeadsPage(
            leads=[
                AdminLeadRow(
                    id=str(l.id), agent_id=str(l.agent_id) if l.agent_id else None,
                    listing_id=str(l.listing_id) if l.listing_id else None, clicked_at=l.clicked_at, ip_hash=l.ip_hash,
                    contact_type=l.contact_type, name=l.name, phone=l.phone,
                    listings=TitleRef(id=str(l.listing_id), title=l_map[str(l.listing_id)]) if str(l.listing_id) in l_map else None,
                    agents=AgentOption(id=str(l.agent_id), name=a_map[str(l.agent_id)]) if str(l.agent_id) in a_map else None,
                )
                for l in leads
            ],
            agents=[AgentOption(id=str(i), name=n) for i, n in agents],
            listings=[TitleRef(id=str(i), title=t) for i, t in listings],
        )

    # ── Commissions & transfers ────────────────────────────────────────────

    @staticmethod
    async def commissions_page(db: AsyncSession, user: AuthenticatedUser) -> AdminCommissionsPage:
        require_admin(user)
        rows = (await db.execute(select(Commission).order_by(Commission.created_at.desc()))).scalars().all()
        agents = (await db.execute(select(AgentProfile.id, AgentProfile.name).order_by(AgentProfile.name.asc()))).all()
        listings = {str(i): t for i, t in (await db.execute(select(Listing.id, Listing.title))).all()}
        a_map = {str(i): n for i, n in agents}
        out = [
            AdminCommissionRow(
                id=str(c.id), agent_id=str(c.agent_id) if c.agent_id else None, amount=float(c.amount), status=c.status,
                created_at=c.created_at, paid_at=c.paid_at,
                agents=AgentOption(id=str(c.agent_id), name=a_map[str(c.agent_id)]) if str(c.agent_id) in a_map else None,
                listings=TitleRef(id=str(c.listing_id), title=listings[str(c.listing_id)]) if str(c.listing_id) in listings else None,
            )
            for c in rows
        ]
        return AdminCommissionsPage(
            commissions=out, agents=[AgentOption(id=str(i), name=n) for i, n in agents],
            total_pending=sum(r.amount for r in out if r.status == "pending"),
            total_paid=sum(r.amount for r in out if r.status == "paid"),
        )

    @staticmethod
    async def create_commission(db: AsyncSession, user: AuthenticatedUser, data) -> Commission:
        """A manual pending commission; the agent's balance moves with it, as for automatic ones."""
        require_admin(user)
        await AdminConsoleService._agent(db, data.agent_id)
        await AdminConsoleService._listing(db, data.listing_id)
        commission = Commission(
            id=str(uuid.uuid4()), agent_id=data.agent_id, listing_id=data.listing_id, amount=data.amount,
            status="pending", created_at=datetime.now(timezone.utc),
        )
        db.add(commission)
        await db.execute(
            update(AgentProfile).where(AgentProfile.id == data.agent_id)
            .values(commission_balance=func.coalesce(AgentProfile.commission_balance, 0) + data.amount)
        )
        await db.flush()
        return commission

    @staticmethod
    async def transfers(db: AsyncSession, user: AuthenticatedUser) -> List[TransferRow]:
        require_admin(user)
        rows = (await db.execute(select(TransferHistory).order_by(TransferHistory.transferred_at.desc()))).scalars().all()
        titles = {str(i): t for i, t in (await db.execute(select(Listing.id, Listing.title))).all()}
        names = {str(i): n for i, n in (await db.execute(select(AgentProfile.id, AgentProfile.name))).all()}
        return [
            TransferRow(
                id=str(t.id), listing_id=str(t.listing_id), previous_owner_id=str(t.previous_owner_id),
                new_owner_id=str(t.new_owner_id), transferred_by=str(t.transferred_by), transferred_at=t.transferred_at,
                listing_title=titles.get(str(t.listing_id), "—"), previous_owner_name=names.get(str(t.previous_owner_id), "—"),
                new_owner_name=names.get(str(t.new_owner_id), "—"),
            )
            for t in rows
        ]

    # ── Analytics ──────────────────────────────────────────────────────────

    @staticmethod
    async def analytics(db: AsyncSession, user: AuthenticatedUser) -> AdminAnalytics:
        require_admin(user)
        summary = (await db.execute(text("SELECT * FROM public.get_platform_view_summary()"))).mappings().first() or {}
        students = (await db.execute(text("SELECT public.get_registered_student_count()"))).scalar_one() or 0
        listings = (await db.execute(text("SELECT * FROM public.get_admin_listing_view_analytics(20)"))).mappings().all()
        agents = (await db.execute(text("SELECT * FROM public.get_admin_agent_view_analytics()"))).mappings().all()

        def clean(row) -> dict:
            return {k: (str(v) if k.endswith("_id") and v is not None else (int(v) if hasattr(v, "as_integer_ratio") and k.endswith("_count") else v)) for k, v in dict(row).items()}

        return AdminAnalytics(summary=clean(summary), total_students=int(students),
                              top_listings=[clean(r) for r in listings], top_agents=[clean(r) for r in agents])
