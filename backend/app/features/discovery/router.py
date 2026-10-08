import json
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.device import get_device_id
from app.core.errors import BadRequestException, NotFoundException
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_optional_current_user
from app.features.discovery import service
from app.features.discovery.schemas import AlertCreate, AlertRead, SearchCard, SearchResponse, SimilarResponse

router = APIRouter(prefix="/discovery", tags=["Discovery"])


def _csv(value: Optional[str]) -> List[str]:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


@router.get("/search", response_model=SearchResponse, summary="Search Places",
            description="Plain-language and filtered search with explainable ranking. `q` understands things like "
                        "'bedsitter near dekut under 8k with wifi'; explicit filters win over what is inferred. "
                        "Cursor paged (max 50 per page). Public.")
@limiter.limit("120/minute")
async def search_places(
    request: Request, response: Response,
    q: str = Query("", max_length=200), market: Optional[str] = None,
    mode: str = Query("monthly", pattern="^(monthly|nightly)$"),
    place: Optional[str] = Query(None, description="Comma-separated place slugs"),
    kind: Optional[str] = Query(None, pattern="^(hostel|apartment|house|compound|room)$"),
    unit_kind: Optional[str] = Query(None, description="Comma-separated unit kinds"),
    min_price: Optional[float] = Query(None, ge=0), max_price: Optional[float] = Query(None, ge=0),
    amenities: Optional[str] = Query(None, description="Comma-separated"),
    has_video: Optional[bool] = None, near: Optional[str] = Query(None, description="Landmark slug"),
    max_walk: Optional[int] = Query(None, ge=1, le=120), gender: Optional[str] = Query(None, pattern="^(women|men)$"),
    sort: str = Query("best", pattern="^(best|newest|price_asc|price_desc)$"),
    limit: int = Query(20, ge=1, le=service.MAX_LIMIT), cursor: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> SearchResponse:
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=120"
    params = service.SearchParams(
        market=market, q=q.strip(), mode=mode, places=_csv(place), kind=kind, unit_kind=_csv(unit_kind),
        min_price=min_price, max_price=max_price, amenities=_csv(amenities), has_video=has_video, near=near,
        max_walk=max_walk, gender=gender, sort=sort, limit=limit, offset=service.decode_cursor(cursor),
    )
    return await service.search(db, params)


@router.get("/properties/{slug}/similar", response_model=SimilarResponse, summary="Similar Places Nearby",
            description="Places of the same kind at a similar price, same area first. Public.")
async def similar_places(slug: str, response: Response, limit: int = Query(6, ge=1, le=12),
                         db: AsyncSession = Depends(get_db_session, scope="function")) -> SimilarResponse:
    response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=300"
    return SimilarResponse(items=await service.similar(db, slug, limit))


@router.get("/cards", response_model=SimilarResponse, summary="Cards For Saved Places",
            description="Cards for up to 50 listing ids, in the order given, including places that are now let or paused.")
async def cards_by_listing_ids(ids: str = Query(..., description="Comma-separated listing ids"),
                               db: AsyncSession = Depends(get_db_session, scope="function")) -> SimilarResponse:
    return SimilarResponse(items=await service.cards_for_listing_ids(db, _csv(ids)))


class ListerProfile(BaseModel):
    name: str
    slug: str
    since_year: int
    places: List[SearchCard]
    reply_rate: Optional[float] = None


@router.get("/listers/{slug}", response_model=ListerProfile, summary="Lister Profile",
            description="A lister organisation's public page: who they are and their live places. Public.")
async def lister_profile(slug: str, response: Response, db: AsyncSession = Depends(get_db_session, scope="function")) -> ListerProfile:
    response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=300"
    return ListerProfile(**await service.org_profile(db, slug))


# ── Alerts (saved searches) ─────────────────────────────────────────────────────────────────────

@router.post("/alerts", response_model=AlertRead, status_code=status.HTTP_201_CREATED, summary="Create An Alert",
             description="Save a search and be told when new places match. Works without an account (per device). "
                         "Needs an email (sent today) or a phone number (WhatsApp, once a provider is connected).")
@limiter.limit("10/minute")
async def create_alert(
    request: Request, body: AlertCreate, device_id: Optional[str] = Depends(get_device_id),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> AlertRead:
    if not device_id and not user:
        raise BadRequestException("A device id (X-Device-Id) or a signed-in session is required.")
    if body.channel == "email" and not (body.email and "@" in body.email):
        raise BadRequestException("Enter a valid email address.")
    if body.channel == "whatsapp":
        from app.features.hostel_requests.service import clean_kenyan_phone

        body.phone = clean_kenyan_phone(body.phone or "")
    if len(json.dumps(body.intent)) > 2000:
        raise BadRequestException("That search is too large to save.")
    row = (
        await db.execute(
            text(
                """
                INSERT INTO saved_searches (device_id, user_id, intent, label, channel, email, phone, frequency)
                VALUES (CAST(:d AS uuid), CAST(:u AS uuid), CAST(:i AS jsonb), :l, :c, :e, :p, :f)
                RETURNING id, created_at
                """
            ),
            {"d": device_id, "u": user.id if user else None, "i": json.dumps(body.intent), "l": body.label,
             "c": body.channel, "e": body.email if body.channel == "email" else None,
             "p": body.phone if body.channel == "whatsapp" else None, "f": body.frequency},
        )
    ).one()
    return AlertRead(id=str(row[0]), label=body.label, intent=body.intent, channel=body.channel, frequency=body.frequency,
                     active=True, created_at=row[1])


@router.get("/alerts", response_model=List[AlertRead], summary="My Alerts")
async def list_alerts(device_id: Optional[str] = Depends(get_device_id),
                      user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
                      db: AsyncSession = Depends(get_db_session, scope="function")) -> List[AlertRead]:
    rows = (
        await db.execute(
            text(
                """
                SELECT id, label, intent, channel, frequency, active, created_at FROM saved_searches
                WHERE active AND ((CAST(:u AS uuid) IS NOT NULL AND user_id = CAST(:u AS uuid))
                               OR (CAST(:d AS uuid) IS NOT NULL AND device_id = CAST(:d AS uuid)))
                ORDER BY created_at DESC
                """
            ),
            {"u": user.id if user else None, "d": device_id},
        )
    ).mappings().all()
    return [AlertRead(id=str(r["id"]), label=r["label"], intent=r["intent"], channel=r["channel"], frequency=r["frequency"],
                      active=r["active"], created_at=r["created_at"]) for r in rows]


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete An Alert")
async def delete_alert(alert_id: str, device_id: Optional[str] = Depends(get_device_id),
                       user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
                       db: AsyncSession = Depends(get_db_session, scope="function")) -> None:
    result = await db.execute(
        text(
            """
            UPDATE saved_searches SET active = false WHERE id = CAST(:a AS uuid) AND active
              AND ((CAST(:u AS uuid) IS NOT NULL AND user_id = CAST(:u AS uuid))
                OR (CAST(:d AS uuid) IS NOT NULL AND device_id = CAST(:d AS uuid)))
            """
        ),
        {"a": alert_id, "u": user.id if user else None, "d": device_id},
    )
    if result.rowcount == 0:
        raise NotFoundException("Alert not found.")
