from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import AuthenticatedUser, require_roles
from app.core.tasks.worker import send_push_to_user
from app.features.campuses.schemas import CampusManagerRead
from app.features.listings.schemas import ListingRead
from app.features.manager.schemas import (
    AgentStandingUpdate,
    ApplicationRejection,
    CampusQuickCreate,
    CampusSettingsUpdate,
    FoundUser,
    ManagedAgentRead,
    ManagedAnnouncementRead,
    ManagedApplicationRead,
    ManagedListingRead,
    ManagerAssignment,
    ManagerContext,
    ManagerOverview,
    OwnerPhoneUpdate,
    PromotableAgent,
    StaffMember,
)
from app.features.manager.service import ManagerService
from app.features.official_hostels.schemas import OfficialHostelsOverview

router = APIRouter(prefix="/manager", tags=["Manager"])

Manager = Depends(require_roles("manager"))  # admins pass automatically
Db = Depends(get_db_session, scope="function")


def _push(background_tasks: BackgroundTasks, push) -> None:
    if push is not None:
        background_tasks.add_task(
            send_push_to_user, push.user_id, push.title, push.body, {"url": push.url, "type": "manager"}
        )


@router.get("/context", response_model=ManagerContext, summary="Manager Context",
            description="Who the caller is as a manager/admin: scope, campus name, display name.")
async def get_context(user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> ManagerContext:
    return await ManagerService.context(db, user)


@router.get("/overview", response_model=ManagerOverview, summary="Manager Overview",
            description="Counts for the manager home page, limited to the campuses in scope.")
async def get_overview(user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> ManagerOverview:
    return await ManagerService.overview(db, user)


@router.get("/campuses", response_model=List[CampusManagerRead], summary="Campuses I Manage",
            description="Full campus rows for the campuses in scope (all for admins).")
async def list_campuses(user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> List[CampusManagerRead]:
    return [CampusManagerRead.model_validate(c) for c in await ManagerService.campuses(db, user)]


@router.patch("/campuses/{campus_id}", response_model=CampusManagerRead, summary="Update Campus Settings",
              description="Managers: contact/branding/fees of campuses they manage (needs ≥1 zone). Admins: also name/slug/region/status.")
async def update_campus_settings(
    campus_id: str, data: CampusSettingsUpdate, user: AuthenticatedUser = Manager, db: AsyncSession = Db,
) -> CampusManagerRead:
    return CampusManagerRead.model_validate(await ManagerService.update_campus_settings(db, user, campus_id, data))


@router.post("/campuses", response_model=CampusManagerRead, status_code=status.HTTP_201_CREATED, summary="Create Campus (Admin)",
             description="Starts as coming_soon with placeholder branding. 409 if the slug exists.")
async def create_campus(data: CampusQuickCreate, user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> CampusManagerRead:
    return CampusManagerRead.model_validate(await ManagerService.create_campus(db, user, data))


@router.get("/announcements", response_model=List[ManagedAnnouncementRead], summary="Announcements In Scope",
            description="All announcements (including expired) for the campuses in scope.")
async def list_announcements(user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> List[ManagedAnnouncementRead]:
    return await ManagerService.list_announcements(db, user)


@router.get("/applications", response_model=List[ManagedApplicationRead], summary="Agent Applications In Scope")
async def list_applications(user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> List[ManagedApplicationRead]:
    return await ManagerService.list_applications(db, user)


@router.post("/applications/{application_id}/approve", status_code=status.HTTP_200_OK,
             summary="Approve Application",
             description="Creates the agent record, promotes the applicant to 'agent', notifies them. 409 if already processed.")
async def approve_application(
    application_id: str, background_tasks: BackgroundTasks, user: AuthenticatedUser = Manager, db: AsyncSession = Db,
) -> dict:
    _, push = await ManagerService.approve_application(db, user, application_id)
    _push(background_tasks, push)
    return {"status": "approved"}


@router.post("/applications/{application_id}/reject", status_code=status.HTTP_200_OK,
             summary="Reject Application", description="Rejects with a reason and notifies the applicant.")
async def reject_application(
    application_id: str, data: ApplicationRejection, background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Manager, db: AsyncSession = Db,
) -> dict:
    _, push = await ManagerService.reject_application(db, user, application_id, data.reason)
    _push(background_tasks, push)
    return {"status": "rejected"}


@router.get("/agents", response_model=List[ManagedAgentRead], summary="Agents In Scope")
async def list_agents(user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> List[ManagedAgentRead]:
    return await ManagerService.list_agents(db, user)


@router.patch("/agents/{agent_id}/standing", status_code=status.HTTP_200_OK, summary="Suspend / Reinstate Agent",
              description="Changes only status and suspension_reason; a reason is required to suspend.")
async def set_agent_standing(
    agent_id: str, data: AgentStandingUpdate, background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Manager, db: AsyncSession = Db,
) -> dict:
    _, push = await ManagerService.set_agent_standing(db, user, agent_id, data.status, data.suspension_reason)
    _push(background_tasks, push)
    return {"status": data.status}


@router.get("/listings", response_model=List[ManagedListingRead], summary="Listings In Scope")
async def list_listings(user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> List[ManagedListingRead]:
    return await ManagerService.list_listings(db, user)


@router.get("/listings/{listing_id}", response_model=ListingRead, summary="Listing For Editing",
            description="A listing in the manager's scope (404 otherwise), including inactive ones.")
async def get_managed_listing(listing_id: str, user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> ListingRead:
    return ListingRead.model_validate(await ManagerService.get_managed_listing(db, user, listing_id))


@router.patch("/listings/{listing_id}/owner-phone", status_code=status.HTTP_200_OK, summary="Set Owner Phone")
async def set_owner_phone(
    listing_id: str, data: OwnerPhoneUpdate, user: AuthenticatedUser = Manager, db: AsyncSession = Db,
) -> dict:
    listing = await ManagerService.set_owner_phone(db, user, listing_id, data.landlord_phone)
    return {"landlord_phone": listing.landlord_phone}


@router.get("/hostels", response_model=OfficialHostelsOverview, summary="Hostels In Scope",
            description="Official records plus the in-scope listings, for cross-checking.")
async def hostels(user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> OfficialHostelsOverview:
    return await ManagerService.hostels_overview(db, user)


# ── Staff (admin only) ─────────────────────────────────────────────────────────

@router.get("/staff", response_model=List[StaffMember], summary="Staff (Admin)")
async def list_staff(user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> List[StaffMember]:
    return await ManagerService.list_staff(db, user)


@router.get("/staff/find", response_model=FoundUser, summary="Find User By Email (Admin)")
async def find_user(email: str = Query(..., min_length=3), user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> FoundUser:
    return await ManagerService.find_user_by_email(db, user, email)


@router.get("/staff/search-agents", response_model=List[PromotableAgent], summary="Search Agents To Promote (Admin)")
async def search_agents(q: str = Query("", max_length=100), user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> List[PromotableAgent]:
    return await ManagerService.search_agents_to_promote(db, user, q)


@router.put("/staff/{target_user_id}", response_model=StaffMember, summary="Assign Manager Role (Admin)",
            description="Sets role manager with a campus OR region scope (not both).")
async def assign_manager(
    target_user_id: str, data: ManagerAssignment, user: AuthenticatedUser = Manager, db: AsyncSession = Db,
) -> StaffMember:
    p = await ManagerService.assign_manager(db, user, target_user_id, data.managed_campus_id, data.managed_region_id)
    return StaffMember(id=str(p.id), full_name=p.full_name, email=p.email, role=p.role,
                       managed_campus_id=str(p.managed_campus_id) if p.managed_campus_id else None,
                       managed_region_id=str(p.managed_region_id) if p.managed_region_id else None)


@router.delete("/staff/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove Manager Role (Admin)",
               description="Downgrades the manager back to agent.")
async def remove_manager(target_user_id: str, user: AuthenticatedUser = Manager, db: AsyncSession = Db) -> None:
    await ManagerService.remove_manager(db, user, target_user_id)
