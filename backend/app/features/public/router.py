from typing import List

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.ratelimit import limiter
from app.features.public.schemas import PublicAgent, SitemapResponse, VerifyCandidate
from app.features.public.service import PublicService

router = APIRouter(prefix="/public", tags=["Public"])


@router.get(
    "/agents/{slug_or_id}",
    response_model=PublicAgent,
    status_code=status.HTTP_200_OK,
    summary="Public Agent Profile",
    description="An active agent's public profile by slug (or by id, so legacy URLs can redirect to the slug). Public.",
)
async def get_public_agent(
    slug_or_id: str, db: AsyncSession = Depends(get_db_session, scope="function")
) -> PublicAgent:
    return await PublicService.get_agent(db, slug_or_id)


@router.get(
    "/support-team",
    response_model=List[PublicAgent],
    status_code=status.HTTP_200_OK,
    summary="Customer Support Team",
    description="Admin-curated support agents shown on the Hakikisha page, in rank order. Public.",
)
async def get_support_team(db: AsyncSession = Depends(get_db_session, scope="function")) -> List[PublicAgent]:
    return await PublicService.support_team(db)


@router.get(
    "/verify-lookup",
    response_model=List[VerifyCandidate],
    status_code=status.HTTP_200_OK,
    summary="Verify-Before-You-Pay Lookup",
    description=(
        "Active listings matching ONE phone number, payment detail or name the visitor typed into the "
        "Hakikisha checker (max 10). Payment details are returned only when the search was by payment "
        "detail. Rate limited. Public."
    ),
)
@limiter.limit("20/minute")
async def verify_lookup(
    request: Request,
    q: str = Query(..., min_length=3, max_length=100, description="Phone number, M-Pesa detail or hostel name"),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> List[VerifyCandidate]:
    return await PublicService.verify_lookup(db, q)


@router.get(
    "/sitemap",
    response_model=SitemapResponse,
    status_code=status.HTTP_200_OK,
    summary="Sitemap Data",
    description="Slugs and last-modified times of active listings and agents. Public.",
)
async def get_sitemap(db: AsyncSession = Depends(get_db_session, scope="function")) -> SitemapResponse:
    return await PublicService.sitemap(db)
