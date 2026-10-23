import hashlib
import time
import uuid
from typing import Dict, Optional, Tuple

from sqlalchemy import select
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import BadRequestException, ForbiddenException
from app.features.agents.models import AgentProfile
from app.core.ratelimit import _client_ip, limiter
from app.core.security import AuthenticatedUser, get_current_user, get_optional_current_user, require_roles
from app.features.analytics.schemas import (
    AgentListingViewEntry,
    PlatformViewSummary,
    TrackViewRequest,
    TrackViewResponse,
    ViewCountRead,
)
from app.features.analytics.service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# The public "N people viewed today" line is read on every property page view. Counts change slowly (about a hundred
# recorded views a day site-wide), so each worker answers from memory for a minute instead of counting again.
VIEW_COUNTS_TTL_SECONDS = 60
_VIEW_COUNTS_MAX = 5000
_view_counts_cache: Dict[str, Tuple[float, ViewCountRead]] = {}


@router.post(
    "/track-view",
    response_model=TrackViewResponse,
    status_code=status.HTTP_200_OK,
    summary="Track Listing View",
    description="Record a listing page view (public; signed-in users are deduplicated per user, anonymous visitors per IP+user-agent). Admins and agents are never counted.",
)
@limiter.limit("60/minute")
async def track_listing_view(
    request: Request,
    payload: TrackViewRequest,
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> TrackViewResponse:
    fingerprint = f"{_client_ip(request)}:{request.headers.get('user-agent', '')}"
    return await AnalyticsService.track_view(
        db=db,
        listing_id=payload.listing_id,
        user_id=user.id if user else None,
        ip_hash=hashlib.sha256(fingerprint.encode()).hexdigest(),
    )


@router.get(
    "/views/{listing_id}",
    response_model=ViewCountRead,
    status_code=status.HTTP_200_OK,
    summary="Get Listing View Counts",
    description="Fetch today/week/month/all-time view counts for a listing. Public.",
)
async def get_view_counts(
    listing_id: str,
    response: Response,
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> ViewCountRead:
    try:
        key = str(uuid.UUID(listing_id))
    except ValueError:
        raise BadRequestException("Invalid listing id")
    response.headers["Cache-Control"] = f"public, max-age={VIEW_COUNTS_TTL_SECONDS}"
    now = time.monotonic()
    hit = _view_counts_cache.get(key)
    if hit and hit[0] > now:
        return hit[1]
    counts = await AnalyticsService.get_listing_view_counts(db=db, listing_id=key)
    if len(_view_counts_cache) >= _VIEW_COUNTS_MAX:
        _view_counts_cache.clear()  # bounded: a full reset is cheap and keeps memory flat
    _view_counts_cache[key] = (now + VIEW_COUNTS_TTL_SECONDS, counts)
    return counts


@router.get(
    "/agent/{agent_id}",
    response_model=list[AgentListingViewEntry],
    status_code=status.HTTP_200_OK,
    summary="Agent Listing Analytics",
    description="View analytics per listing for an agent: the agent themself, or an admin.",
)
async def get_agent_analytics(
    agent_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> list[AgentListingViewEntry]:
    # Access follows the agent record, not the profile role (managers can be agents too). An agent may only read their own analytics (admins any).
    if not user.is_admin:
        owns = await db.execute(
            select(AgentProfile.id).where(AgentProfile.id == agent_id, AgentProfile.user_id == user.id)
        )
        if owns.scalar_one_or_none() is None:
            raise ForbiddenException("You can only view analytics for your own listings")
    return await AnalyticsService.get_agent_view_analytics(db=db, agent_id=agent_id)


@router.get(
    "/platform/summary",
    response_model=PlatformViewSummary,
    status_code=status.HTTP_200_OK,
    summary="Platform-wide View Summary",
    description="Platform-wide view counts (today/week/month/all-time). Admin only.",
)
async def get_platform_summary(
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> PlatformViewSummary:
    return await AnalyticsService.get_platform_view_summary(db=db)
