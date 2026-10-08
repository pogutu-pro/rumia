from typing import List

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import NotFoundException
from app.features.geo.schemas import LandmarkRead, MarketRead, PlaceRead

router = APIRouter(prefix="/markets", tags=["Geography"])

CACHE = "public, max-age=300, stale-while-revalidate=600"


async def _market_id(db: AsyncSession, slug: str) -> str:
    row = (
        await db.execute(text("SELECT id FROM markets WHERE slug = :s AND status IN ('pilot', 'live')"), {"s": slug})
    ).first()
    if not row:
        raise NotFoundException("Market not found.")
    return str(row[0])


@router.get("", response_model=List[MarketRead], summary="Markets",
            description="Towns Rumia currently serves (live or pilot). Public.")
async def list_markets(response: Response, db: AsyncSession = Depends(get_db_session, scope="function")) -> List[MarketRead]:
    response.headers["Cache-Control"] = CACHE
    rows = (
        await db.execute(
            text("SELECT slug, name, status, center_lat, center_lng FROM markets WHERE status IN ('pilot', 'live') ORDER BY name")
        )
    ).mappings().all()
    return [MarketRead(**{**r, "center_lat": float(r["center_lat"]) if r["center_lat"] is not None else None,
                          "center_lng": float(r["center_lng"]) if r["center_lng"] is not None else None}) for r in rows]


@router.get("/{market_slug}/places", response_model=List[PlaceRead], summary="Places In A Market",
            description="Neighbourhoods and towns of a market with the number of live listings in each. Public.")
async def list_places(market_slug: str, response: Response, db: AsyncSession = Depends(get_db_session, scope="function")) -> List[PlaceRead]:
    response.headers["Cache-Control"] = CACHE
    market_id = await _market_id(db, market_slug)
    rows = (
        await db.execute(
            text(
                """
                SELECT p.slug, p.name, p.kind, p.aliases, p.lat, p.lng,
                       (SELECT count(*) FROM listings l WHERE l.place_id = p.id AND l.is_active) AS listing_count
                FROM places p WHERE p.market_id = CAST(:m AS uuid) ORDER BY listing_count DESC, p.name
                """
            ),
            {"m": market_id},
        )
    ).mappings().all()
    return [
        PlaceRead(slug=r["slug"], name=r["name"], kind=r["kind"], aliases=list(r["aliases"] or []),
                  lat=float(r["lat"]) if r["lat"] is not None else None,
                  lng=float(r["lng"]) if r["lng"] is not None else None, listing_count=int(r["listing_count"]))
        for r in rows
    ]


@router.get("/{market_slug}/landmarks", response_model=List[LandmarkRead], summary="Landmarks In A Market",
            description="Universities, town centres and other points people orient by. Public.")
async def list_landmarks(market_slug: str, response: Response, db: AsyncSession = Depends(get_db_session, scope="function")) -> List[LandmarkRead]:
    response.headers["Cache-Control"] = CACHE
    market_id = await _market_id(db, market_slug)
    rows = (
        await db.execute(
            text("SELECT slug, name, kind, aliases, lat, lng, features FROM landmarks WHERE market_id = CAST(:m AS uuid) ORDER BY name"),
            {"m": market_id},
        )
    ).mappings().all()
    return [
        LandmarkRead(slug=r["slug"], name=r["name"], kind=r["kind"], aliases=list(r["aliases"] or []),
                     lat=float(r["lat"]), lng=float(r["lng"]), features=dict(r["features"] or {}))
        for r in rows
    ]
