"""Compare SQLAlchemy models against a live Postgres schema.

Reports, per mapped table: columns the model expects that the DB lacks (queries on
them 500), and DB columns the model does not map (harmless, but data the API can't
serve). Exit code 1 if any model column is missing from the DB.

Usage:  DATABASE_URL=postgresql+asyncpg://... uv run python scripts/check_schema_drift.py
"""
import asyncio
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

import app.api  # noqa: F401  (imports every feature's models so Base.metadata is complete)
from app.core.config import settings
from app.core.database import Base


async def main() -> int:
    engine = create_async_engine(settings.DATABASE_URL)
    missing_cols: dict[str, list[str]] = {}
    unmapped_cols: dict[str, list[str]] = {}
    missing_tables: list[str] = []
    async with engine.connect() as conn:
        rows = (await conn.execute(text(
            "select table_name, column_name, data_type from information_schema.columns where table_schema='public'"
        ))).all()
    db: dict[str, set[str]] = {}
    db_types: dict[tuple[str, str], str] = {}
    for table, column, data_type in rows:
        db.setdefault(table, set()).add(column)
        db_types[(table, column)] = data_type
    type_mismatches: list[str] = []

    for name, table in sorted(Base.metadata.tables.items()):
        if name not in db:
            missing_tables.append(name)
            continue
        model_cols = {c.name for c in table.columns}
        for col in table.columns:
            db_type = db_types.get((name, col.name))
            if db_type is None:
                continue
            model_is_uuid = isinstance(col.type, PG_UUID)
            model_is_text = isinstance(col.type, (String, Text))  # String covers Text
            # uuid <-> text mixes make `uuid = varchar` comparisons fail at query time
            if (model_is_text and db_type == "uuid") or (model_is_uuid and db_type != "uuid"):
                type_mismatches.append(f"{name}.{col.name}: model {col.type!r} vs DB {db_type}")
        if gone := sorted(model_cols - db[name]):
            missing_cols[name] = gone
        if extra := sorted(db[name] - model_cols):
            unmapped_cols[name] = extra
    await engine.dispose()

    print("== Model tables missing from DB:", missing_tables or "none")
    print("== Model columns missing from DB (these queries FAIL):")
    for t, cols in missing_cols.items():
        print(f"   {t}: {', '.join(cols)}")
    if not missing_cols:
        print("   none")
    print("== uuid/text type mismatches (comparisons FAIL):")
    for line in type_mismatches:
        print("   " + line)
    if not type_mismatches:
        print("   none")
    print("== DB columns not mapped by the model (informational):")
    for t, cols in unmapped_cols.items():
        print(f"   {t}: {', '.join(cols)}")
    return 1 if (missing_cols or missing_tables or type_mismatches) else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
