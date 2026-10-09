import pytest
from sqlalchemy import text

from app.features.notifications import email_worker
from tests_pg.conftest import make_campus, make_profile, make_user


@pytest.mark.asyncio
async def test_email_sweep_claims_each_row_once_and_skips_final_rows(db, monkeypatch):
    user = await make_user(db)
    await make_profile(db, user, await make_campus(db))
    rows = {}
    for status, retries in [("pending", 0), ("deferred", 1), ("failed", 0), ("sent", 0), ("deferred", 3)]:
        r = await db.execute(
            text(
                """
                INSERT INTO email_deliveries (user_id, notification_type, to_email, subject, template_name,
                                              status, retry_count, idempotency_key)
                VALUES (CAST(:u AS uuid), 't', 'a@b.c', 's', 'tpl', :s, :r, gen_random_uuid()::text)
                RETURNING id
                """
            ),
            {"u": user, "s": status, "r": retries},
        )
        rows[(status, retries)] = str(r.scalar_one())
    # The table's updated_at trigger would reset the timestamp; pause it to age the rows.
    await db.execute(text("ALTER TABLE email_deliveries DISABLE TRIGGER email_deliveries_updated_at"))
    await db.execute(text("UPDATE email_deliveries SET updated_at = now() - interval '5 minutes'"))
    await db.execute(text("ALTER TABLE email_deliveries ENABLE TRIGGER email_deliveries_updated_at"))

    sent = []

    async def fake_send_one(delivery_id: str):
        sent.append(delivery_id)

    class _Ctx:
        async def __aenter__(self_inner):
            return db

        async def __aexit__(self_inner, *a):
            return False

    monkeypatch.setattr(email_worker, "async_session_factory", lambda: _Ctx())
    monkeypatch.setattr(email_worker.EmailDeliveryWorker, "send_one", staticmethod(fake_send_one))
    monkeypatch.setattr(email_worker, "BREVO_PACING_DELAY", 0)

    await email_worker.EmailDeliveryWorker.retry_pending()
    assert set(sent) == {rows[("pending", 0)], rows[("deferred", 1)]}

    # A second sweep inside the lease window picks nothing up: no double sends.
    sent.clear()
    await email_worker.EmailDeliveryWorker.retry_pending()
    assert sent == []
