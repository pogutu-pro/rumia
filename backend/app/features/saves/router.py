from typing import List, Optional

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.device import get_device_id
from app.core.errors import BadRequestException
from app.core.ratelimit import limiter
from app.core.security import AuthenticatedUser, get_current_user, get_optional_current_user
from app.features.saves.service import SaveService

router = APIRouter(prefix="/saves", tags=["Saves"])


class SavedIds(BaseModel):
    listing_ids: List[str]


class MergeResult(BaseModel):
    merged: int


@router.get("", response_model=SavedIds, summary="Saved Listing Ids",
            description="Ids saved by the signed-in user, or by this device when not signed in. Public.")
async def list_saved(
    device_id: Optional[str] = Depends(get_device_id),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> SavedIds:
    return SavedIds(listing_ids=await SaveService.list_ids(db, user.id if user else None, device_id))


@router.put("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Save A Listing",
            description="Save for the signed-in user, or for this device (X-Device-Id) when not signed in.")
@limiter.limit("120/minute")
async def save_listing(
    request: Request,
    listing_id: str,
    device_id: Optional[str] = Depends(get_device_id),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> None:
    await SaveService.add(db, listing_id, user.id if user else None, device_id)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Unsave A Listing")
@limiter.limit("120/minute")
async def unsave_listing(
    request: Request,
    listing_id: str,
    device_id: Optional[str] = Depends(get_device_id),
    user: Optional[AuthenticatedUser] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> None:
    await SaveService.remove(db, listing_id, user.id if user else None, device_id)


@router.post("/merge", response_model=MergeResult, summary="Merge Device Saves Into Account",
             description="Call after sign-in with the device's X-Device-Id. Authenticated.")
async def merge_saves(
    device_id: Optional[str] = Depends(get_device_id),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> MergeResult:
    if not device_id:
        raise BadRequestException("X-Device-Id header required.")
    return MergeResult(merged=await SaveService.merge_device_into_user(db, user.id, device_id))
