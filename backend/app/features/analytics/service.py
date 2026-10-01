import json
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.analytics.schemas import (
    AgentListingViewEntry,
    PlatformViewSummary,
    TrackViewResponse,
    ViewCountRead,
)


class AnalyticsService:
    @staticmethod
    async def track_view(
        db: AsyncSession,
        listing_id: str,
        user_id: Optional[str] = None,
        ip_hash: Optional[str] = None,
    ) -> TrackViewResponse:
        """Delegate to the Supabase RPC `track_listing_view` stored procedure."""
        result = await db.execute(
            text("SELECT public.track_listing_view(CAST(:listing_id AS uuid), CAST(:user_id AS uuid), :ip_hash)"),
            {
                "listing_id": listing_id,
                "user_id": user_id,
                "ip_hash": ip_hash,
            },
        )
        row = result.scalar_one_or_none()
        if isinstance(row, str):  # asyncpg returns jsonb from a raw text() query as a JSON string
            row = json.loads(row)
        if not row:
            return TrackViewResponse(inserted=False, reason="rpc_error")
        return TrackViewResponse(
            inserted=row.get("inserted", False),
            dedupe=row.get("dedupe"),
            reason=row.get("reason"),
        )

    @staticmethod
    async def get_listing_view_counts(
        db: AsyncSession,
        listing_id: str,
    ) -> ViewCountRead:
        """Calls DB RPC `get_listing_view_counts`."""
        result = await db.execute(
            text("SELECT * FROM public.get_listing_view_counts(CAST(:listing_id AS uuid))"),
            {"listing_id": listing_id},
        )
        row = result.fetchone()
        if not row:
            return ViewCountRead(listing_id=listing_id, today_count=0, week_count=0, month_count=0, all_time_count=0)
        return ViewCountRead(
            listing_id=listing_id,
            today_count=row.today_count or 0,
            week_count=row.week_count or 0,
            month_count=row.month_count or 0,
            all_time_count=row.all_time_count or 0,
        )

    @staticmethod
    async def get_agent_view_analytics(
        db: AsyncSession,
        agent_id: str,
    ) -> List[AgentListingViewEntry]:
        result = await db.execute(
            text("SELECT * FROM public.get_agent_listing_view_analytics(CAST(:agent_id AS uuid))"),
            {"agent_id": agent_id},
        )
        rows = result.fetchall()
        return [
            AgentListingViewEntry(
                listing_id=str(r.listing_id),
                listing_title=r.listing_title,
                listing_slug=r.listing_slug,
                today_count=r.today_count or 0,
                week_count=r.week_count or 0,
                month_count=r.month_count or 0,
                all_time_count=r.all_time_count or 0,
            )
            for r in rows
        ]

    @staticmethod
    async def get_platform_view_summary(db: AsyncSession) -> PlatformViewSummary:
        result = await db.execute(
            text("SELECT * FROM public.get_platform_view_summary()"),
        )
        row = result.fetchone()
        if not row:
            return PlatformViewSummary(today_count=0, week_count=0, month_count=0, all_time_count=0)
        return PlatformViewSummary(
            today_count=row.today_count or 0,
            week_count=row.week_count or 0,
            month_count=row.month_count or 0,
            all_time_count=row.all_time_count or 0,
        )
