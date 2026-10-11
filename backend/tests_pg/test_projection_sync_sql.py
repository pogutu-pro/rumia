import pytest
from sqlalchemy import text

from app.features.catalog.drift import find_projection_drift
from app.features.catalog.service import project_listing
from tests_pg.conftest import make_agent, make_campus, make_listing, make_user


async def _valid_registry(db, pid) -> int:
    return (await db.execute(
        text("SELECT count(*) FROM verification_evidence WHERE subject = 'property' AND subject_id = CAST(:p AS uuid) "
             "AND kind = 'registry_match' AND status = 'valid'"), {"p": pid})).scalar_one()


async def _listing(db):
    campus = await make_campus(db)
    agent = await make_agent(db, campus, user_id=await make_user(db))
    return await make_listing(db, agent, campus, title="Sync Heights")


@pytest.mark.asyncio
async def test_admin_verify_then_unverify_reaches_the_property_trust_badge(db):
    listing = await _listing(db)
    pid = await project_listing(db, listing)
    assert await _valid_registry(db, pid) == 0

    await db.execute(text("UPDATE listings SET verified = true, verified_source = 'Admin Manual Verification', "
                          "verified_date = current_date WHERE id = CAST(:l AS uuid)"), {"l": listing})
    await project_listing(db, listing)
    assert await _valid_registry(db, pid) == 1

    await db.execute(text("UPDATE listings SET verified = false, verified_source = NULL, verified_date = NULL "
                          "WHERE id = CAST(:l AS uuid)"), {"l": listing})
    await project_listing(db, listing)
    assert await _valid_registry(db, pid) == 0  # revoked, not left behind

    await db.execute(text("UPDATE listings SET verified = true, verified_source = 'Official records' "
                          "WHERE id = CAST(:l AS uuid)"), {"l": listing})
    await project_listing(db, listing)
    assert await _valid_registry(db, pid) == 1  # and it comes back
    assert (await db.execute(text("SELECT count(*) FROM verification_evidence WHERE subject_id = CAST(:p AS uuid) "
                                  "AND kind = 'registry_match'"), {"p": pid})).scalar_one() == 1  # one row, reused


@pytest.mark.asyncio
async def test_drift_check_is_clean_after_projection_and_catches_a_missed_one(db):
    listing = await _listing(db)
    await project_listing(db, listing)
    ours = lambda rows: [r for r in rows if str(r["listing_id"]) == str(listing)]
    assert ours(await find_projection_drift(db)) == []

    # A write that skipped the copy is reported.
    await db.execute(text("UPDATE listings SET title = 'Edited Without Copy' WHERE id = CAST(:l AS uuid)"), {"l": listing})
    assert [r["check_name"] for r in ours(await find_projection_drift(db))] == ["name_differs"]


@pytest.mark.asyncio
async def test_reporting_logs_an_error_only_when_something_disagrees(db, caplog):
    from app.features.catalog.drift import report_projection_drift

    listing = await _listing(db)
    await project_listing(db, listing)
    with caplog.at_level("ERROR", logger="app.features.catalog.drift"):
        await report_projection_drift(db)
    assert [r for r in caplog.records if listing in r.getMessage()] == []  # in sync: nothing about this listing

    await db.execute(text("UPDATE listings SET title = 'Edited Without Copy' WHERE id = CAST(:l AS uuid)"), {"l": listing})
    with caplog.at_level("ERROR", logger="app.features.catalog.drift"):
        rows = await report_projection_drift(db)
    assert any(str(r["listing_id"]) == listing for r in rows)
    message = " ".join(r.getMessage() for r in caplog.records if r.levelname == "ERROR")
    assert "projection drift" in message and "name_differs=" in message
