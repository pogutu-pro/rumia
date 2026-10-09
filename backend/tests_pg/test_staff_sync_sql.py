import pytest
from sqlalchemy import text

from app.core.permissions import load_access, sync_staff_for_role
from tests_pg.conftest import make_user


async def _roles(db, user):
    return sorted(role for role, _ in (await load_access(db, user)).staff)


@pytest.mark.asyncio
async def test_promoting_through_the_old_screens_grants_ops_access_and_demoting_removes_it(db):
    user = await make_user(db)
    assert await _roles(db, user) == []

    await sync_staff_for_role(db, user, "manager")
    assert await _roles(db, user) == ["market_lead"]
    assert (await load_access(db, user)).can_staff_anywhere("queue.view")

    await sync_staff_for_role(db, user, "admin")
    assert await _roles(db, user) == ["admin"]  # manager scope dropped, admin everywhere
    assert (await load_access(db, user)).can("staff.manage")

    await sync_staff_for_role(db, user, "agent")
    assert await _roles(db, user) == []
    assert not (await load_access(db, user)).can_staff_anywhere("queue.view")

    # Promoting again reuses the row instead of piling up duplicates.
    await sync_staff_for_role(db, user, "admin")
    await sync_staff_for_role(db, user, "admin")
    assert (await db.execute(text("SELECT count(*) FROM staff_assignments WHERE user_id = CAST(:u AS uuid) AND role = 'admin'"), {"u": user})).scalar_one() == 1


@pytest.mark.asyncio
async def test_hand_made_reviewer_assignments_survive_a_role_change(db):
    user = await make_user(db)
    await db.execute(text("INSERT INTO staff_assignments (user_id, market_id, role) VALUES (CAST(:u AS uuid), NULL, 'reviewer')"), {"u": user})
    await sync_staff_for_role(db, user, "manager")
    await sync_staff_for_role(db, user, "student")
    assert await _roles(db, user) == ["reviewer"]
