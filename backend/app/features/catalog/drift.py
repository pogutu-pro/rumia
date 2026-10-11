"""Detect listings that disagree with their copy in the property model.

The legacy `listings` tables are still the write path and `project_listing()` copies each save into
`properties`. A write that skips the copy (a direct database edit, a new admin screen, a copy that failed and was
only logged) leaves the two models apart, and nothing else would notice. This runs the same check as
`scripts/check-projection-drift.sql` (a symlink to `drift_check.sql`, so there is one definition) and reports.
"""
import logging
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_SQL = (Path(__file__).with_name("drift_check.sql")).read_text()
SAMPLE = 5


async def find_projection_drift(db: AsyncSession) -> List[Dict[str, Any]]:
    """One row per disagreement: check_name, listing_id, detail. Empty when the two models agree."""
    # text() reads ':name' as a bind parameter but leaves '::' casts alone; the trailing ';' is not wanted.
    rows = (await db.execute(text(_SQL.rstrip().rstrip(";")))).mappings().all()
    return [dict(r) for r in rows]


async def report_projection_drift(db: AsyncSession) -> List[Dict[str, Any]]:
    """Run the check and log an ERROR (which Sentry turns into an event) when anything disagrees."""
    rows = await find_projection_drift(db)
    if rows:
        by_check = Counter(r["check_name"] for r in rows)
        sample = "; ".join(f"{r['check_name']} {r['listing_id']}" for r in rows[:SAMPLE])
        logger.error(
            "projection drift: %d listing(s) disagree with their property copy (%s). Examples: %s. "
            "Run scripts/check-projection-drift.sql for the full list.",
            len(rows),
            ", ".join(f"{name}={n}" for name, n in sorted(by_check.items())),
            sample,
        )
    return rows
