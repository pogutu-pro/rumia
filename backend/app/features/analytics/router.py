import hashlib
from typing import Optional

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
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
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> ViewCountRead:
    return await AnalyticsService.get_listing_view_counts(db=db, listing_id=listing_id)


@router.get(
    "/agent/{agent_id}",
    response_model=list[AgentListingViewEntry],
    status_code=status.HTTP_200_OK,
    summary="Agent Listing Analytics",
    description="Get view analytics per listing for a given agent. Agent or Admin only.",
)
async def get_agent_analytics(
    agent_id: str,
    user: AuthenticatedUser = Depends(require_roles("agent", "admin")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> list[AgentListingViewEntry]:
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
