import uuid

import pytest
from sqlalchemy import text

from app.core.errors import BadRequestException, ForbiddenException
from app.core.permissions import AccessContext, load_access
from app.features.catalog import lifecycle, reports
from app.features.catalog.service import project_listing
from app.features.ops import service as ops
from app.features.workspace.router import add_member, my_workspace
from tests_pg.conftest import make_agent, make_campus, make_listing, make_user


async def _place(db, title="Ops Place", user=None):
    campus = await make_campus(db)
    owner = user or await make_user(db)
    agent = await make_agent(db, campus, user_id=owner)
    listing = await make_listing(db, agent, campus, title=title, county="nyeri", area="boma")
    await db.execute(text("INSERT INTO listing_room_types (listing_id, room_type, price, is_available) VALUES (CAST(:l AS uuid), 'Bedsitter', 6000, true)"), {"l": listing})
    pid = await project_listing(db, listing)
    return pid, owner


async def _market(db, slug="nyeri"):
    return str((await db.execute(text("SELECT id FROM markets WHERE slug = :s"), {"s": slug})).scalar_one())


@pytest.mark.asyncio
async def test_review_decisions_move_places_and_record_why(db):
    pid, _ = await _place(db)
    reviewer = await make_user(db)
    await lifecycle.transition(db, pid, "in_review", actor_kind="system", reason="held after repeated scam reports")
    access = AccessContext(reviewer, staff={("reviewer", await _market(db))})

    queue = await ops.review_queue(db, access)
    assert [q["id"] for q in queue if str(q["id"]) == pid] and queue[0]["reason"].startswith("held after")

    with pytest.raises(BadRequestException):
        await ops.decide_review(db, pid, "reject", reviewer, None)  # a reason is required
    assert await ops.decide_review(db, pid, "request_changes", reviewer, "Add a photo of the bathroom") == "draft"
    await lifecycle.transition(db, pid, "in_review", actor_kind="lister")
    assert await ops.decide_review(db, pid, "approve", reviewer, None) == "live"


@pytest.mark.asyncio
async def test_staff_only_see_their_own_market(db):
    pid, _ = await _place(db)
    await lifecycle.transition(db, pid, "in_review", actor_kind="system")
    other_market = str((await db.execute(text("INSERT INTO markets (slug, name, status) VALUES ('elsewhere', 'Elsewhere', 'pilot') RETURNING id"))).scalar_one())
    outsider = AccessContext("x", staff={("reviewer", other_market)})
    insider = AccessContext("y", staff={("reviewer", await _market(db))})
    everywhere = AccessContext("z", staff={("admin", None)})
    assert not [q for q in await ops.review_queue(db, outsider) if str(q["id"]) == pid]
    assert [q for q in await ops.review_queue(db, insider) if str(q["id"]) == pid]
    assert [q for q in await ops.review_queue(db, everywhere) if str(q["id"]) == pid]
    assert (await ops.queues(db, outsider))["review"]["count"] == 0
    assert not outsider.can("property.review", market_id=await _market(db))


@pytest.mark.asyncio
async def test_resolving_a_report_can_remove_the_place_or_suspend_the_organisation(db):
    pid, _ = await _place(db)
    slug = (await db.execute(text("SELECT slug FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()
    await reports.submit_report(db, slug, "scam", "asked for a deposit before viewing", str(uuid.uuid4()), None)
    lead = await make_user(db)
    access = AccessContext(lead, staff={("market_lead", await _market(db))})
    open_ = [r for r in await ops.open_reports(db, access) if str(r["property_id"]) == pid]
    assert open_ and open_[0]["priority"] == 2 and open_[0]["reason"] == "scam"

    await ops.resolve_report(db, str(open_[0]["id"]), "suspend_org", lead, "fake listing")
    org = (await db.execute(text("SELECT o.status FROM lister_orgs o JOIN properties p ON p.org_id = o.id WHERE p.id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()
    assert org == "suspended"
    assert (await db.execute(text("SELECT status FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one() == "removed"
    assert (await db.execute(text("SELECT status FROM reports WHERE property_id = CAST(:p AS uuid)"), {"p": pid})).scalar_one() == "resolved"
    # A suspended organisation loses its members' organisation rights immediately.
    member = (await db.execute(text("SELECT m.user_id FROM org_members m JOIN properties p ON p.org_id = m.org_id WHERE p.id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()
    assert (await load_access(db, str(member))).orgs == {}


@pytest.mark.asyncio
async def test_site_visit_evidence_shows_up_as_a_dated_fact(db):
    from app.features.catalog.service import get_property_read

    pid, _ = await _place(db)
    lead = await make_user(db)
    await ops.record_visit(db, pid, lead, "checked rooms and met caretaker")
    slug = (await db.execute(text("SELECT slug FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()
    facts = [f.text for f in (await get_property_read(db, slug)).facts]
    assert any(t.startswith("Visited by Rumia on") for t in facts)


@pytest.mark.asyncio
async def test_workspace_lists_attention_items_and_team_changes_need_ownership(db):
    pid, owner = await _place(db, "Workspace Place")
    await db.execute(text("UPDATE properties SET status = 'stale' WHERE id = CAST(:p AS uuid)"), {"p": pid})
    access = await load_access(db, owner)
    ws = await my_workspace(access, db)
    assert ws["orgs"][0]["role"] == "owner"
    assert any(a["kind"] == "confirm_availability" and a["name"] == "Workspace Place" for a in ws["attention"])

    colleague = await make_user(db, "colleague@example.com")
    org_id = ws["orgs"][0]["id"]
    from app.features.workspace.router import MemberAdd
    await add_member(org_id, MemberAdd(email="colleague@example.com", role="agent"), access, db)
    assert (await load_access(db, colleague)).orgs == {org_id: "agent"}
    agent_access = await load_access(db, colleague)
    with pytest.raises(ForbiddenException):
        await add_member(org_id, MemberAdd(email="colleague@example.com", role="manager"), agent_access, db)  # agents cannot manage the team


@pytest.mark.asyncio
async def test_market_health_flags_areas_people_search_but_have_no_fresh_supply(db):
    await _place(db)
    await db.execute(
        text("INSERT INTO events (occurred_at, name, market, props) SELECT now(), 'search_performed', 'nyeri', '{\"places\": [\"nyaribo\"]}'::jsonb FROM generate_series(1, 3)")
    )
    health = await ops.market_health(db, "nyeri")
    nyaribo = next(a for a in health["areas"] if a["slug"] == "nyaribo")
    assert nyaribo["searches_30d"] >= 3 and nyaribo["gap"] is True
    assert 0 <= health["fresh_share"] <= 1
