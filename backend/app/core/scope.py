"""Campus/region scope for managers.

A manager oversees one campus (`managed_campus_id`) or every campus in one region
(`managed_region_id`); admins oversee everything. Use these helpers for every manager/admin
operation so out-of-scope data is never listed or touched.
"""
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException
from app.core.security import AuthenticatedUser, check_campus_scope


async def allowed_campus_ids(db: AsyncSession, user: AuthenticatedUser) -> Optional[List[str]]:
    """None means "all campuses" (admin); otherwise the campuses this manager may see (maybe empty)."""
    if user.is_admin:
        return None
    if user.managed_campus_id:
        return [user.managed_campus_id]
    if user.managed_region_id:
        res = await db.execute(
            text("SELECT id::text AS id FROM public.campuses WHERE region_id = CAST(:r AS uuid)"),
            {"r": user.managed_region_id},
        )
        return [str(row.id) for row in res.fetchall()]
    return []


async def require_campus_scope(
    db: AsyncSession, user: AuthenticatedUser, campus_id: Optional[str], message: str
) -> None:
    """Raise 403 unless the user may manage this campus."""
    if not campus_id or not await check_campus_scope(user, str(campus_id), db):
        raise ForbiddenException(message)
