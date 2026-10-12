import pytest
from sqlalchemy import text

from app.core.permissions import load_access, sync_staff_for_role
from tests_pg.conftest import make_campus, make_profile, make_user


async def _manager_of(db, city='Nyeri'):
    """A user whose profile says which campus they manage; the market follows that campus's city."""
    user = await make_user(db)
    campus = await make_campus(db)
    await db.execute(text("UPDATE campuses SET city = :c WHERE id = CAST(:i AS uuid)"), {"c": city, "i": campus})
    await make_profile(db, user, campus, role='manager')
    await db.execute(text("UPDATE profiles SET managed_campus_id = CAST(:i AS uuid) WHERE id = CAST(:u AS uuid)"), {"i": campus, "u": user})
    return user


async def _roles(db, user):
    return sorted(role for role, _ in (await load_access(db, user)).staff)


@pytest.mark.asyncio
async def test_promoting_through_the_old_screens_grants_ops_access_and_demoting_removes_it(db):
    user = await _manager_of(db)
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
async def test_a_manager_gets_the_market_of_the_campus_they_manage_and_none_if_it_has_no_market(db):
    nyeri = await _manager_of(db, 'Nyeri')
    await sync_staff_for_role(db, nyeri, "manager")
    assert (await db.execute(text("SELECT m.slug FROM staff_assignments s JOIN markets m ON m.id = s.market_id WHERE s.user_id = CAST(:u AS uuid) AND s.role = 'market_lead'"), {"u": nyeri})).scalar_one() == "nyeri"

    elsewhere = await _manager_of(db, 'Atlantis')
    await sync_staff_for_role(db, elsewhere, "manager")
    assert await _roles(db, elsewhere) == []


@pytest.mark.asyncio
async def test_hand_made_reviewer_assignments_survive_a_role_change(db):
    user = await _manager_of(db)
    await db.execute(text("INSERT INTO staff_assignments (user_id, market_id, role) VALUES (CAST(:u AS uuid), NULL, 'reviewer')"), {"u": user})
    await sync_staff_for_role(db, user, "manager")
    await sync_staff_for_role(db, user, "student")
    assert await _roles(db, user) == ["reviewer"]
