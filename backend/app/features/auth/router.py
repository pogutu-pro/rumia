from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import BadRequestException
from app.core.ratelimit import limiter
from app.features.auth.schemas import (
    DevLoginRequest,
    GoogleCallbackRequest,
    GoogleStartRequest,
    GoogleStartResponse,
    LogoutRequest,
    SessionTokens,
    TokenRequest,
)
from app.features.auth.service import AuthService, ensure_enabled

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/google/start", response_model=GoogleStartResponse, summary="Begin Google sign-in")
@limiter.limit("30/minute")
async def google_start(request: Request, data: GoogleStartRequest) -> GoogleStartResponse:
    ensure_enabled()
    url, state = AuthService.build_google_url(data.next, data.app_redirect)
    return GoogleStartResponse(url=url, state=state)


@router.post("/google/callback", response_model=SessionTokens, summary="Finish Google sign-in")
@limiter.limit("20/minute")
async def google_callback(
    request: Request,
    data: GoogleCallbackRequest,
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> SessionTokens:
    ensure_enabled()
    return await AuthService.google_callback(db, data.code, data.state)


@router.post("/token", response_model=SessionTokens, summary="Refresh a session or redeem a mobile one-time code")
@limiter.limit("60/minute")
async def token(
    request: Request,
    data: TokenRequest,
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> SessionTokens:
    ensure_enabled()
    if data.grant_type == "refresh_token" and data.refresh_token:
        return await AuthService.refresh(db, data.refresh_token)
    if data.grant_type == "otc" and data.code:
        return await AuthService.exchange_otc(db, data.code)
    raise BadRequestException("Missing token for grant_type")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Revoke a session")
async def logout(data: LogoutRequest, db: AsyncSession = Depends(get_db_session, scope="function")) -> None:
    ensure_enabled()
    await AuthService.logout(db, data.refresh_token)


@router.post("/dev-login", response_model=SessionTokens, summary="Development-only login without Google")
async def dev_login(data: DevLoginRequest, db: AsyncSession = Depends(get_db_session, scope="function")) -> SessionTokens:
    return await AuthService.dev_login(db, data.email, data.full_name)
