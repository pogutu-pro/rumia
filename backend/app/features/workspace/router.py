from typing import Any, Dict, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import BadRequestException, NotFoundException
from app.core.permissions import AccessContext, get_access

router = APIRouter(tags=["Workspace"])


class MemberAdd(BaseModel):
    email: str
    role: str = "agent"


@router.get("/me/workspace", summary="My Workspace",
            description="The caller's organisations and places, each with what needs attention (unconfirmed, paused, drafts) "
                        "and the last week's contacts. One call powers the lister home screen.")
async def my_workspace(access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> Dict[str, Any]:
    if not access.orgs:
        return {"orgs": [], "properties": [], "attention": []}
    org_ids = list(access.orgs)
    orgs = (await db.execute(text("SELECT id, name, slug, status FROM lister_orgs WHERE id = ANY(CAST(:o AS uuid[]))"), {"o": org_ids})).mappings().all()
    props = (
        await db.execute(
            text(
                """
                SELECT p.id, p.org_id, p.slug, p.name, p.status, p.last_confirmed_at,
                       (SELECT count(*) FROM inquiries i WHERE i.listing_id = p.legacy_listing_id AND i.created_at > now() - interval '7 days') AS contacts_7d,
                       (SELECT count(*) FROM inquiries i WHERE i.listing_id = p.legacy_listing_id AND i.replied IS NULL AND i.created_at > now() - interval '7 days') AS awaiting_reply
                FROM properties p WHERE p.org_id = ANY(CAST(:o AS uuid[])) AND p.status <> 'archived'
                ORDER BY (p.status IN ('stale','paused','draft')) DESC, p.last_confirmed_at NULLS FIRST
                """
            ),
            {"o": org_ids},
        )
    ).mappings().all()
    attention = []
    for p in props:
        if p["status"] == "stale":
            attention.append({"property_id": str(p["id"]), "slug": p["slug"], "name": p["name"], "kind": "confirm_availability",
                              "text": "Still available? Not confirmed recently."})
        elif p["status"] == "paused":
            attention.append({"property_id": str(p["id"]), "slug": p["slug"], "name": p["name"], "kind": "resume", "text": "Hidden from search until you confirm."})
        elif p["status"] == "draft":
            attention.append({"property_id": str(p["id"]), "slug": p["slug"], "name": p["name"], "kind": "finish_draft", "text": "Finish and submit this draft."})
        if p["awaiting_reply"]:
            attention.append({"property_id": str(p["id"]), "slug": p["slug"], "name": p["name"], "kind": "reply",
                              "text": f"{p['awaiting_reply']} contact(s) this week have not been marked as replied."})
    return {
        "orgs": [{"id": str(o["id"]), "name": o["name"], "slug": o["slug"], "status": o["status"], "role": access.orgs[str(o["id"])]} for o in orgs],
        "properties": [{**{k: (str(v) if k in ("id", "org_id") else v) for k, v in dict(p).items()}} for p in props],
        "attention": attention,
    }


@router.get("/orgs/{org_id}/inquiries", summary="Recent Contacts For An Organisation",
            description="Reference code, place, channel and whether the seeker said they got a reply. No personal details.")
async def org_inquiries(org_id: str, access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> List[Dict[str, Any]]:
    access.require("property.edit", org_id=org_id)
    rows = (
        await db.execute(
            text(
                """
                SELECT i.ref_code, i.channel, i.created_at, i.replied, i.outcome, p.name, p.slug
                FROM inquiries i JOIN properties p ON p.legacy_listing_id = i.listing_id
                WHERE p.org_id = CAST(:o AS uuid) ORDER BY i.created_at DESC LIMIT 100
                """
            ),
            {"o": org_id},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


@router.post("/orgs/{org_id}/members", status_code=status.HTTP_204_NO_CONTENT, summary="Add A Team Member",
             description="Add an existing Rumia user (by email) to the organisation. Owners only.")
async def add_member(org_id: str, body: MemberAdd, access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> None:
    access.require("org.manage_members", org_id=org_id)
    if body.role not in ("manager", "agent"):
        raise BadRequestException("Members can be managers or agents.")
    user = (await db.execute(text("SELECT id FROM auth.users WHERE lower(email) = lower(:e)"), {"e": body.email.strip()})).first()
    if not user:
        raise NotFoundException("No account with that email. Ask them to sign in to Rumia once first.")
    await db.execute(
        text("INSERT INTO org_members (org_id, user_id, role) VALUES (CAST(:o AS uuid), CAST(:u AS uuid), :r) ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role WHERE org_members.role <> 'owner'"),
        {"o": org_id, "u": str(user[0]), "r": body.role},
    )


class OutcomeBody(BaseModel):
    outcome: str  # moved_in | not_suitable | no_reply


@router.post("/orgs/{org_id}/inquiries/{ref_code}/outcome", status_code=status.HTTP_204_NO_CONTENT,
             summary="Confirm What Happened To A Contact",
             description="The lister reports whether this contact moved in. This is the only event that can create a fee.")
async def lister_outcome(org_id: str, ref_code: str, body: OutcomeBody, access: AccessContext = Depends(get_access),
                         db: AsyncSession = Depends(get_db_session, scope="function")) -> None:
    access.require("property.confirm", org_id=org_id)
    if body.outcome not in ("moved_in", "not_suitable", "no_reply"):
        raise BadRequestException("Unknown outcome.")
    from app.features.inquiries.service import InquiryService

    await InquiryService.lister_outcome(db, org_id, ref_code, body.outcome)
