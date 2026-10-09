import pytest
from sqlalchemy import text

from app.features.auth.service import AuthService


@pytest.mark.asyncio
async def test_new_account_with_admin_in_the_email_is_a_student(db):
    """Regression: a database trigger once made any email containing 'admin' an admin."""
    user_id = await AuthService._upsert_user(db, "Kamau.Administrator@gmail.com", "Kamau", None, "sub-1")
    await AuthService._login(db, user_id, "Kamau.Administrator@gmail.com", "Kamau", None)
    role = (await db.execute(text("SELECT role FROM profiles WHERE id = CAST(:i AS uuid)"), {"i": user_id})).scalar_one()
    assert role == "student"


@pytest.mark.asyncio
async def test_signing_in_twice_reuses_one_user_even_if_email_case_differs(db):
    first = await AuthService._upsert_user(db, "jane@example.com", "Jane", None, "sub-2")
    second = await AuthService._upsert_user(db, "Jane@Example.com", "Jane", None, "sub-2")
    assert first == second
