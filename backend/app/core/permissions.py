"""Named permissions with market / organisation scope, resolved from the database.

Replaces role-string checks for the new catalog and ops endpoints. A user holds:
  * staff assignments (admin | market_lead | reviewer | scout), optionally scoped to one market, and
  * organisation memberships (owner | manager | agent) of lister organisations.
Anyone else is a seeker with no special rights. Legacy `require_roles` keeps working for old routes.
"""
import logging
from dataclasses import dataclass, field
from typing import Dict, FrozenSet, Optional, Set, Tuple

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import ForbiddenException, ServiceUnavailableException
from app.core.security import AuthenticatedUser, get_current_user

# What each staff role may do (within its market, or everywhere for market=None assignments).
STAFF_PERMISSIONS: Dict[str, FrozenSet[str]] = {
    "admin": frozenset({
        "property.create", "property.edit", "property.confirm", "property.pause", "property.remove",
        "property.review", "property.verify", "report.resolve", "org.suspend", "org.manage_members",
        "queue.view", "market.manage", "staff.manage", "ledger.view",
    }),
    "market_lead": frozenset({
        "property.create", "property.edit", "property.confirm", "property.pause", "property.remove",
        "property.review", "property.verify", "report.resolve", "org.suspend", "queue.view", "ledger.view",
    }),
    "reviewer": frozenset({"property.review", "property.verify", "report.resolve", "queue.view"}),
    "scout": frozenset({"property.create", "property.edit"}),
}

# What each membership of a lister organisation may do on that organisation's properties.
ORG_PERMISSIONS: Dict[str, FrozenSet[str]] = {
    "owner": frozenset({"property.create", "property.edit", "property.confirm", "property.pause", "org.manage_members"}),
    "manager": frozenset({"property.create", "property.edit", "property.confirm", "property.pause"}),
    "agent": frozenset({"property.create", "property.edit", "property.confirm"}),
}


@dataclass
class AccessContext:
    user_id: str
    staff: Set[Tuple[str, Optional[str]]] = field(default_factory=set)  # (role, market_id or None)
    orgs: Dict[str, str] = field(default_factory=dict)  # org_id -> role

    def can(self, permission: str, *, market_id: Optional[str] = None, org_id: Optional[str] = None) -> bool:
        for role, scope in self.staff:
            if permission in STAFF_PERMISSIONS.get(role, frozenset()) and (scope is None or scope == market_id):
                return True
        if org_id and permission in ORG_PERMISSIONS.get(self.orgs.get(org_id, ""), frozenset()):
            return True
        return False

    def can_staff_anywhere(self, permission: str) -> bool:
        """Staff holding this permission in any market (used where the target has no single market)."""
        return any(permission in STAFF_PERMISSIONS.get(role, frozenset()) for role, _ in self.staff)

    def can_anywhere(self, permission: str) -> bool:
        """Holds the permission in at least one scope (for screens that then filter by scope)."""
        if any(permission in STAFF_PERMISSIONS.get(role, frozenset()) for role, _ in self.staff):
            return True
        return any(permission in ORG_PERMISSIONS.get(role, frozenset()) for role in self.orgs.values())

    def require(self, permission: str, *, market_id: Optional[str] = None, org_id: Optional[str] = None) -> None:
        if not self.can(permission, market_id=market_id, org_id=org_id):
            raise ForbiddenException("You do not have permission to do that.")

    @property
    def staff_markets(self) -> Optional[Set[str]]:
        """None when staff everywhere; otherwise the markets they are scoped to."""
        if any(scope is None for _, scope in self.staff):
            return None
        return {scope for _, scope in self.staff if scope}


async def load_access(db: AsyncSession, user_id: str) -> AccessContext:
    try:
        staff_rows = (
            await db.execute(
                text("SELECT role, market_id FROM staff_assignments WHERE user_id = CAST(:u AS uuid) AND active"),
                {"u": user_id},
            )
        ).all()
        org_rows = (
            await db.execute(
                text(
                    """
                    SELECT m.org_id, m.role FROM org_members m JOIN lister_orgs o ON o.id = m.org_id
                    WHERE m.user_id = CAST(:u AS uuid) AND o.status <> 'suspended'
                    """
                ),
                {"u": user_id},
            )
        ).all()
    except Exception as exc:  # fail closed: never guess a user's rights
        raise ServiceUnavailableException("We could not verify your permissions right now.") from exc
    return AccessContext(
        user_id=user_id,
        staff={(r[0], str(r[1]) if r[1] else None) for r in staff_rows},
        orgs={str(r[0]): r[1] for r in org_rows},
    )


async def get_access(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> AccessContext:
    return await load_access(db, user.id)


async def sync_staff_for_role(db: AsyncSession, user_id: str, role: Optional[str]) -> None:
    """Keep staff assignments in step with the legacy profile role, which admin and manager screens still set.

    admin/super_admin -> an everywhere `admin`; manager -> `market_lead` in the default market; anything else
    loses those two derived assignments. Assignments made by hand in the ops console (reviewer, scout) are left alone.
    Never raises: the role change that triggered it must not fail because of this.
    """
    try:
        async with db.begin_nested():
            params = {"u": str(user_id)}
            if role in ("admin", "super_admin"):
                await db.execute(
                    text(
                        "UPDATE staff_assignments SET active = true WHERE user_id = CAST(:u AS uuid) AND role = 'admin' AND market_id IS NULL"
                    ),
                    params,
                )
                await db.execute(
                    text(
                        """
                        INSERT INTO staff_assignments (user_id, market_id, role)
                        SELECT CAST(:u AS uuid), NULL, 'admin'
                        WHERE NOT EXISTS (SELECT 1 FROM staff_assignments WHERE user_id = CAST(:u AS uuid) AND role = 'admin' AND market_id IS NULL)
                        """
                    ),
                    params,
                )
                keep = ("admin",)
            elif role == "manager":
                await db.execute(
                    text(
                        """
                        INSERT INTO staff_assignments (user_id, market_id, role)
                        SELECT CAST(:u AS uuid), m.id, 'market_lead' FROM markets m WHERE m.slug = 'nyeri'
                          AND NOT EXISTS (SELECT 1 FROM staff_assignments s WHERE s.user_id = CAST(:u AS uuid) AND s.role = 'market_lead' AND s.market_id = m.id)
                        """
                    ),
                    params,
                )
                await db.execute(
                    text(
                        "UPDATE staff_assignments SET active = true WHERE user_id = CAST(:u AS uuid) AND role = 'market_lead' "
                        "AND market_id = (SELECT id FROM markets WHERE slug = 'nyeri')"
                    ),
                    params,
                )
                keep = ("market_lead",)
            else:
                keep = ()
            await db.execute(
                text(
                    "UPDATE staff_assignments SET active = false WHERE user_id = CAST(:u AS uuid) AND active "
                    "AND role IN ('admin', 'market_lead') AND NOT (role = ANY(CAST(:keep AS text[])))"
                ),
                {**params, "keep": list(keep)},
            )
    except Exception:
        logging.getLogger(__name__).exception("could not sync staff assignments for %s", user_id)
