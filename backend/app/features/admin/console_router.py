from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import AuthenticatedUser, require_roles
from app.core.tasks.worker import send_push_to_user
from app.features.admin.console_schemas import (
    AdminAgentDetail,
    AdminAgentRow,
    AdminAnalytics,
    AdminCommissionsPage,
    AdminLeadsPage,
    AdminListingsPage,
    AdminOverview,
    AdminUserRow,
    AgentCreateRequest,
    AgentFlags,
    AgentPatch,
    AgentPromoteRequest,
    AgentSupportPatch,
    AgentVerificationResult,
    CommissionCreate,
    CommissionLockToggle,
    ListingLeadsPage,
    ListingOrderRequest,
    ListingVerificationResult,
    RoleChange,
    SupportAgentRow,
    TransferRow,
    VerifiedToggle,
    VerifyAllSummary,
)
from app.features.admin.console_service import AdminConsoleService
from app.features.manager.schemas import AgentStandingUpdate as AgentStanding
from app.features.manager.service import ManagerService

router = APIRouter(prefix="/admin", tags=["Admin Console"])

Admin = Depends(require_roles("admin"))
Db = Depends(get_db_session, scope="function")


@router.get("/overview", response_model=AdminOverview, summary="Admin Overview")
async def overview(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> AdminOverview:
    return await AdminConsoleService.overview(db, user)


@router.get("/users", response_model=List[AdminUserRow], summary="All Users")
async def list_users(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> List[AdminUserRow]:
    return await AdminConsoleService.list_users(db, user)


@router.patch("/users/{target_id}/role", status_code=status.HTTP_200_OK, summary="Change User Role",
              description="Set a user's role to student or agent (also how privileged roles are demoted).")
async def change_role(target_id: str, data: RoleChange, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    await AdminConsoleService.change_role(db, user, target_id, data.role)
    return {"role": data.role}


@router.post("/users/{target_id}/promote-admin", status_code=status.HTTP_200_OK, summary="Promote To Admin")
async def promote_to_admin(target_id: str, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    await AdminConsoleService.promote_to_admin(db, user, target_id)
    return {"role": "admin"}


@router.get("/agents", response_model=List[AdminAgentRow], summary="Agents With Stats")
async def list_agents(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> List[AdminAgentRow]:
    return await AdminConsoleService.list_agents(db, user)


@router.get("/support-agents", response_model=List[SupportAgentRow], summary="Agents For Support-Team Curation")
async def support_agents(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> List[SupportAgentRow]:
    return await AdminConsoleService.list_support_agents(db, user)


@router.post("/agents", status_code=status.HTTP_201_CREATED, summary="Create Agent",
             description="Creates a login identity and the agent record (rolled back together on failure).")
async def create_agent(
    data: AgentCreateRequest, background_tasks: BackgroundTasks, user: AuthenticatedUser = Admin, db: AsyncSession = Db,
) -> dict:
    agent, pushes = await AdminConsoleService.create_agent(db, user, data)
    for push in pushes:
        background_tasks.add_task(send_push_to_user, push.user_id, push.title, push.body, {"url": push.url, "type": "admin"})
    return {"id": str(agent.id), "slug": agent.slug}


@router.post("/agents/promote", status_code=status.HTTP_201_CREATED, summary="Promote User To Agent")
async def promote_student(data: AgentPromoteRequest, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    agent = await AdminConsoleService.promote_student(db, user, data)
    return {"id": str(agent.id), "slug": agent.slug}


@router.get("/agents/{agent_id}", response_model=AdminAgentDetail, summary="Agent Detail")
async def agent_detail(agent_id: str, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> AdminAgentDetail:
    return await AdminConsoleService.agent_detail(db, user, agent_id)


@router.patch("/agents/{agent_id}", status_code=status.HTTP_200_OK, summary="Edit Agent Details")
async def patch_agent(agent_id: str, data: AgentPatch, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    agent = await AdminConsoleService.patch_agent(db, user, agent_id, data)
    return {"id": str(agent.id)}


@router.patch("/agents/{agent_id}/flags", status_code=status.HTTP_200_OK, summary="Featured / Founder / Verified")
async def set_flags(agent_id: str, data: AgentFlags, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    agent = await AdminConsoleService.set_flags(db, user, agent_id, data)
    return {"is_featured": bool(agent.is_featured), "is_founder": bool(agent.is_founder), "verified": bool(agent.verified)}


@router.patch("/agents/{agent_id}/support", status_code=status.HTTP_200_OK, summary="Support-Team Placement",
              description="Making an agent the owner clears the previous owner.")
async def set_support(agent_id: str, data: AgentSupportPatch, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    agent = await AdminConsoleService.set_support(db, user, agent_id, data)
    return {"is_support": bool(agent.is_support), "support_rank": agent.support_rank, "is_owner": bool(agent.is_owner)}


@router.get("/agents/{agent_id}/verification", response_model=AgentVerificationResult, summary="Check Agent Against Official Records")
async def agent_verification(agent_id: str, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> AgentVerificationResult:
    return await AdminConsoleService.agent_verification(db, user, agent_id)


@router.patch("/agents/{agent_id}/standing", status_code=status.HTTP_200_OK, summary="Suspend / Reactivate Agent",
              description="Reason required to suspend; the agent is notified.")
async def agent_standing(
    agent_id: str, data: AgentStanding, background_tasks: BackgroundTasks, user: AuthenticatedUser = Admin, db: AsyncSession = Db,
) -> dict:
    _, push = await ManagerService.set_agent_standing(db, user, agent_id, data.status, data.suspension_reason)
    if push:
        background_tasks.add_task(send_push_to_user, push.user_id, push.title, push.body, {"url": push.url, "type": "admin"})
    return {"status": data.status}


@router.get("/listings", response_model=AdminListingsPage, summary="Listings With Ordering Info")
async def listings_page(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> AdminListingsPage:
    return await AdminConsoleService.listings_page(db, user)


@router.put("/listings/order", status_code=status.HTTP_200_OK, summary="Set Listing Order",
            description="Atomic reorder with an audit row per change; null clears a position.")
async def reorder(data: ListingOrderRequest, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    await AdminConsoleService.reorder(db, user, data.updates)
    return {"updated": len(data.updates)}


@router.post("/listings/shuffle", status_code=status.HTTP_200_OK, summary="Shuffle Listing Order")
async def shuffle(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    await AdminConsoleService.shuffle(db, user)
    return {"shuffled": True}


@router.post("/listings/verify-all", response_model=VerifyAllSummary, summary="Verify All Active Listings")
async def verify_all(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> VerifyAllSummary:
    return await AdminConsoleService.verify_all(db, user)


@router.post("/listings/{listing_id}/verify", response_model=ListingVerificationResult, summary="Verify One Listing",
             description="Checks the official records and fills verification fields that are not already set.")
async def verify_listing(listing_id: str, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> ListingVerificationResult:
    return await AdminConsoleService.verify_listing(db, user, listing_id)


@router.patch("/listings/{listing_id}/verified", status_code=status.HTTP_200_OK, summary="Manually (Un)verify A Listing")
async def set_verified(listing_id: str, data: VerifiedToggle, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    listing = await AdminConsoleService.set_listing_verified(db, user, listing_id, data.verified)
    return {"verified": bool(listing.verified)}


@router.patch("/listings/{listing_id}/commission-lock", status_code=status.HTTP_200_OK, summary="Lock / Unlock Commission Setting")
async def commission_lock(listing_id: str, data: CommissionLockToggle, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    listing = await AdminConsoleService.set_commission_lock(db, user, listing_id, data.locked)
    return {"commission_locked_by_admin": bool(listing.commission_locked_by_admin)}


@router.get("/listings/{listing_id}/leads", response_model=ListingLeadsPage, summary="Leads Of One Listing")
async def listing_leads(listing_id: str, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> ListingLeadsPage:
    return await AdminConsoleService.listing_leads(db, user, listing_id)


@router.get("/leads", response_model=AdminLeadsPage, summary="All Leads")
async def leads_page(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> AdminLeadsPage:
    return await AdminConsoleService.leads_page(db, user)


@router.get("/commissions", response_model=AdminCommissionsPage, summary="Commissions")
async def commissions_page(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> AdminCommissionsPage:
    return await AdminConsoleService.commissions_page(db, user)


@router.post("/commissions", status_code=status.HTTP_201_CREATED, summary="Create Commission")
async def create_commission(data: CommissionCreate, user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> dict:
    commission = await AdminConsoleService.create_commission(db, user, data)
    return {"id": str(commission.id)}


@router.get("/transfers", response_model=List[TransferRow], summary="Listing Transfer History")
async def transfers(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> List[TransferRow]:
    return await AdminConsoleService.transfers(db, user)


@router.get("/analytics", response_model=AdminAnalytics, summary="Platform Analytics")
async def analytics(user: AuthenticatedUser = Admin, db: AsyncSession = Db) -> AdminAnalytics:
    return await AdminConsoleService.analytics(db, user)
