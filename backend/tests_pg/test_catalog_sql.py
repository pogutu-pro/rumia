import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from app.core.errors import ConflictException, NotFoundException
from app.core.permissions import load_access
from app.core.tasks import jobs
from app.features.catalog import lifecycle, reports
from app.features.catalog.service import get_property_read, refresh_distances, refresh_scores
from app.features.catalog.service import project_listing
from tests_pg.conftest import make_agent, make_campus, make_listing, make_user


async def _live_property(db, **listing_kw):
    campus = await make_campus(db)
    user = await make_user(db)
    agent = await make_agent(db, campus, user_id=user)
    listing = await make_listing(db, agent, campus, title="Kamakwa Heights", **listing_kw)
    await db.execute(text("INSERT INTO listing_room_types (listing_id, room_type, price, deposit, is_available) VALUES (CAST(:l AS uuid), 'Bedsitter', 7500, 7500, true)"), {"l": listing})
    pid = await project_listing(db, listing)
    return pid, listing, user


@pytest.mark.asyncio
async def test_listing_is_projected_with_units_org_and_owner_membership(db):
    pid, listing, user = await _live_property(db)
    prop = await get_property_read(db, (await db.execute(text("SELECT slug FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one())
    assert prop.name == "Kamakwa Heights" and prop.status == "live"
    assert prop.units[0].price_amount == 7500 and prop.units[0].move_in_total == 15000
    assert prop.from_price == 7500 and prop.from_price_period == "month"
    assert (await load_access(db, user)).orgs  # the agent's user owns the organisation

    # Re-projecting after an edit updates in place and never duplicates.
    await db.execute(text("UPDATE listings SET title = 'Kamakwa Heights II' WHERE id = CAST(:l AS uuid)"), {"l": listing})
    assert await project_listing(db, listing) == pid
    assert (await db.execute(text("SELECT count(*) FROM properties WHERE legacy_listing_id = CAST(:l AS uuid)"), {"l": listing})).scalar_one() == 1
    assert (await db.execute(text("SELECT name FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one() == "Kamakwa Heights II"


@pytest.mark.asyncio
async def test_lifecycle_rules_history_and_legacy_mirror(db):
    pid, listing, user = await _live_property(db)
    await lifecycle.transition(db, pid, "let", actor_kind="lister", actor_id=user, reason="rented")
    assert (await db.execute(text("SELECT is_full, is_active FROM listings WHERE id = CAST(:l AS uuid)"), {"l": listing})).one() == (True, True)
    with pytest.raises(ConflictException):
        await lifecycle.transition(db, pid, "stale", actor_kind="system")  # a let place cannot go stale
    await lifecycle.confirm_available(db, pid, actor_kind="lister", actor_id=user)  # available again
    assert (await db.execute(text("SELECT status FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one() == "live"
    history = (await db.execute(text("SELECT from_status, to_status, actor_kind FROM property_status_history WHERE property_id = CAST(:p AS uuid) ORDER BY id"), {"p": pid})).all()
    assert history == [("live", "let", "lister"), ("let", "live", "lister")]
    evidence = (await db.execute(text("SELECT kind FROM verification_evidence WHERE subject_id = CAST(:p AS uuid)"), {"p": pid})).scalars().all()
    assert "availability_confirm" in evidence


@pytest.mark.asyncio
async def test_freshness_sweep_reminds_then_demotes_then_pauses(db):
    pid, _, _ = await _live_property(db)

    async def age(days):
        await db.execute(text("UPDATE properties SET last_confirmed_at = now() - make_interval(days => :d) WHERE id = CAST(:p AS uuid)"), {"d": days, "p": pid})

    async def status():
        return (await db.execute(text("SELECT status FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()

    await age(2)
    assert await lifecycle.freshness_sweep(db) == {"reminded": 0, "stale": 0, "paused": 0}

    await age(11)
    first = await lifecycle.freshness_sweep(db)
    assert first["reminded"] == 1 and await status() == "live"
    assert (await lifecycle.freshness_sweep(db))["reminded"] == 0  # one reminder per period

    await age(15)
    assert (await lifecycle.freshness_sweep(db))["stale"] == 1 and await status() == "stale"

    await age(22)
    assert (await lifecycle.freshness_sweep(db))["paused"] == 1 and await status() == "paused"
    # A paused place's page still resolves (a shared link must not dead-end) but a removed one does not.
    slug = (await db.execute(text("SELECT slug FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()
    assert (await get_property_read(db, slug)).status == "paused"
    await lifecycle.transition(db, pid, "removed", actor_kind="staff")
    with pytest.raises(NotFoundException):
        await get_property_read(db, slug)


@pytest.mark.asyncio
async def test_reports_trigger_stale_and_review_hold_only_with_distinct_reporters(db):
    pid, _, _ = await _live_property(db)
    slug = (await db.execute(text("SELECT slug FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()
    d1, d2 = str(uuid.uuid4()), str(uuid.uuid4())

    await reports.submit_report(db, slug, "not_available", None, d1, None)
    await reports.submit_report(db, slug, "not_available", None, d1, None)  # same person again
    assert (await db.execute(text("SELECT status FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one() == "live"
    assert (await db.execute(text("SELECT count(*) FROM reports WHERE property_id = CAST(:p AS uuid)"), {"p": pid})).scalar_one() == 1

    await reports.submit_report(db, slug, "not_available", None, d2, None)
    assert (await db.execute(text("SELECT status FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one() == "stale"

    await reports.submit_report(db, slug, "scam", "asked for deposit first", d1, None)
    await reports.submit_report(db, slug, "scam", None, d2, None)
    assert (await db.execute(text("SELECT status FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one() == "in_review"
    with pytest.raises(NotFoundException):
        await get_property_read(db, slug)  # held places are hidden until a reviewer decides


@pytest.mark.asyncio
async def test_scores_and_walking_distances(db):
    pid, listing, _ = await _live_property(db, latitude=-0.3950, longitude=36.9640)
    await db.execute(text("UPDATE properties SET lat = -0.3950, lng = 36.9640 WHERE id = CAST(:p AS uuid)"), {"p": pid})
    assert await refresh_distances(db, pid) >= 1
    row = (await db.execute(text("SELECT l.slug, d.walk_min FROM property_landmark_distances d JOIN landmarks l ON l.id = d.landmark_id WHERE d.property_id = CAST(:p AS uuid) AND l.slug = 'dekut'"), {"p": pid})).one()
    assert row[0] == "dekut" and 1 <= row[1] <= 5  # a few hundred metres from the DeKUT coordinates
    await refresh_scores(db)
    quality = (await db.execute(text("SELECT quality_score FROM properties WHERE id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()
    assert 0 < float(quality) < 60  # no photos or video yet, but located, priced and freshly confirmed


@pytest.mark.asyncio
async def test_job_queue_claims_once_retries_with_backoff_and_dedupes(db):
    ran = []

    @jobs.register("t_ok")
    async def ok(payload):
        ran.append(payload["n"])

    first = await jobs.enqueue(db, "t_ok", {"n": 1}, idempotency_key="k1")
    assert first and await jobs.enqueue(db, "t_ok", {"n": 1}, idempotency_key="k1") is None  # duplicate ignored
    claimed = await jobs.claim_due(db, 5)
    assert [c["id"] for c in claimed if c["kind"] == "t_ok"] == [first]
    assert [c for c in await jobs.claim_due(db, 5) if c["id"] == first] == []  # leased, not claimable again

    await jobs.finish(db, first, "boom", attempts=1, max_attempts=3)
    row = (await db.execute(text("SELECT status, attempts, last_error, run_at > now() FROM jobs WHERE id = :i"), {"i": first})).one()
    assert row[0] == "queued" and row[2] == "boom" and row[3] is True  # retried later
    await jobs.finish(db, first, "boom", attempts=3, max_attempts=3)
    assert (await db.execute(text("SELECT status FROM jobs WHERE id = :i"), {"i": first})).scalar_one() == "failed"
