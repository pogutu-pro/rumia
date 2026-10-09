from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import BadRequestException, ForbiddenException, NotFoundException
from app.core.permissions import AccessContext, STAFF_PERMISSIONS, get_access
from app.features.ops import service

router = APIRouter(prefix="/ops", tags=["Ops"])


class Decision(BaseModel):
    decision: str  # approve | request_changes | reject
    note: Optional[str] = None


class ReportResolution(BaseModel):
    resolution: str  # dismiss | resolved | remove_listing | suspend_org
    note: Optional[str] = None


class VisitNote(BaseModel):
    note: Optional[str] = None


class StaffAssignment(BaseModel):
    user_email: str
    role: str
    market_slug: Optional[str] = None


def _need(access: AccessContext, permission: str) -> None:
    if not access.can_staff_anywhere(permission):
        raise ForbiddenException("You do not have permission to do that.")


async def _property_scope(db: AsyncSession, property_id: str) -> Optional[str]:
    row = (await db.execute(text("SELECT market_id FROM properties WHERE id = CAST(:p AS uuid)"), {"p": property_id})).first()
    if not row:
        raise NotFoundException("Property not found.")
    return str(row[0]) if row[0] else None


@router.get("/queues", summary="Work Queues", description="Counts and the age of the oldest item for review, reports, stale places and busy unverified places. Staff only.")
async def get_queues(access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> Dict[str, Any]:
    _need(access, "queue.view")
    return await service.queues(db, access)


@router.get("/review", summary="Review Queue", description="Places waiting for a decision, with why and any duplicate-photo signals.")
async def get_review(access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> List[Dict[str, Any]]:
    _need(access, "property.review")
    return await service.review_queue(db, access)


@router.post("/properties/{property_id}/review", summary="Decide On A Place", description="approve, request_changes or reject (with a note).")
async def decide(property_id: str, body: Decision, access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> Dict[str, str]:
    access.require("property.review", market_id=await _property_scope(db, property_id))
    new = await service.decide_review(db, property_id, body.decision, access.user_id, body.note)
    return {"status": new}


@router.get("/reports", summary="Open Reports", description="Highest priority first (scams, then not-available).")
async def get_reports(access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> List[Dict[str, Any]]:
    _need(access, "report.resolve")
    return await service.open_reports(db, access)


@router.post("/reports/{report_id}/resolve", status_code=status.HTTP_204_NO_CONTENT, summary="Resolve A Report")
async def resolve(report_id: str, body: ReportResolution, access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> None:
    row = (await db.execute(text("SELECT p.market_id FROM reports r JOIN properties p ON p.id = r.property_id WHERE r.id = CAST(:r AS uuid)"), {"r": report_id})).first()
    if not row:
        raise NotFoundException("Report not found.")
    access.require("report.resolve", market_id=str(row[0]) if row[0] else None)
    if body.resolution == "suspend_org":
        access.require("org.suspend", market_id=str(row[0]) if row[0] else None)
    await service.resolve_report(db, report_id, body.resolution, access.user_id, body.note)


@router.get("/stale-orgs", summary="Organisations With Unconfirmed Places")
async def get_stale_orgs(access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> List[Dict[str, Any]]:
    _need(access, "queue.view")
    return await service.stale_orgs(db, access)


@router.post("/properties/{property_id}/visit", status_code=status.HTTP_204_NO_CONTENT, summary="Record A Site Visit",
             description="Adds 'Visited by Rumia' evidence, valid for 12 months.")
async def visit(property_id: str, body: VisitNote = VisitNote(), access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> None:
    access.require("property.verify", market_id=await _property_scope(db, property_id))
    await service.record_visit(db, property_id, access.user_id, body.note)


@router.get("/markets/{market_slug}/health", summary="Market Health", description="Fresh supply against searches per area.")
async def health(market_slug: str, access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> Dict[str, Any]:
    _need(access, "queue.view")
    return await service.market_health(db, market_slug)


@router.put("/staff", status_code=status.HTTP_204_NO_CONTENT, summary="Assign A Staff Role", description="Admins only.")
async def assign_staff(body: StaffAssignment, access: AccessContext = Depends(get_access), db: AsyncSession = Depends(get_db_session, scope="function")) -> None:
    access.require("staff.manage")
    if body.role not in STAFF_PERMISSIONS:
        raise BadRequestException("Unknown role.")
    user = (await db.execute(text("SELECT id FROM auth.users WHERE lower(email) = lower(:e)"), {"e": body.user_email.strip()})).first()
    if not user:
        raise NotFoundException("No account with that email. They need to sign in once first.")
    market_id = None
    if body.market_slug:
        m = (await db.execute(text("SELECT id FROM markets WHERE slug = :s"), {"s": body.market_slug})).first()
        if not m:
            raise NotFoundException("Market not found.")
        market_id = str(m[0])
    elif body.role != "admin":
        raise BadRequestException("Choose a market for this role.")
    await db.execute(
        text(
            """
            INSERT INTO staff_assignments (user_id, market_id, role) VALUES (CAST(:u AS uuid), CAST(:m AS uuid), :r)
            ON CONFLICT (user_id, role, coalesce(market_id, '00000000-0000-0000-0000-000000000000')) DO UPDATE SET active = true
            """
        ),
        {"u": str(user[0]), "m": market_id, "r": body.role},
    )
