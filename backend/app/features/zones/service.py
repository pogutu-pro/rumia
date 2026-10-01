from typing import List, Optional
import uuid
from sqlalchemy import func

from app.core.errors import BadRequestException, NotFoundException
from app.core.scope import require_campus_scope
from app.core.security import AuthenticatedUser
from app.core.slug import slugify, unique_slug
from app.features.listings.models import Listing
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.campuses.models import Campus
from app.features.zones.models import CampusZone


class ZoneService:
    @staticmethod
    async def get_zones(
        db: AsyncSession,
        campus_id: Optional[str] = None,
        campus_slug: Optional[str] = None,
    ) -> List[CampusZone]:
        stmt = select(CampusZone)

        if campus_id:
            stmt = stmt.where(CampusZone.campus_id == campus_id)
        elif campus_slug:
            stmt = stmt.join(Campus, CampusZone.campus_id == Campus.id).where(Campus.slug == campus_slug)

        stmt = stmt.order_by(CampusZone.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())


    # ── Manager-scoped writes ───────────────────────────────────────────────

    @staticmethod
    async def _unique_zone_slug(db: AsyncSession, campus_id: str, name: str, exclude_id: Optional[str] = None) -> str:
        """`campus_zones.slug` is NOT NULL and unique per campus, so it is generated here."""
        base = slugify(name)
        if not base:
            raise BadRequestException("Zone name must contain letters or numbers.")
        stmt = select(CampusZone.slug).where(CampusZone.campus_id == campus_id)
        if exclude_id:
            stmt = stmt.where(CampusZone.id != exclude_id)
        taken = set((await db.execute(stmt)).scalars().all())

        async def is_taken(slug: str) -> bool:
            return slug in taken

        return await unique_slug(base, is_taken)

    @staticmethod
    async def create_zone(db: AsyncSession, user: AuthenticatedUser, data) -> CampusZone:
        await require_campus_scope(db, user, data.campus_id, "You cannot create zones for a campus you do not manage")
        name = data.name.strip()
        if not name:
            raise BadRequestException("Zone name is required.")
        zone = CampusZone(
            id=str(uuid.uuid4()), campus_id=data.campus_id, name=name,
            slug=await ZoneService._unique_zone_slug(db, data.campus_id, name),
            full_search_price=data.full_search_price, distance_category=data.distance_category,
        )
        db.add(zone)
        await db.flush()
        return zone

    @staticmethod
    async def _get_zone(db: AsyncSession, zone_id: str) -> CampusZone:
        zone = (await db.execute(select(CampusZone).where(CampusZone.id == zone_id))).scalar_one_or_none()
        if zone is None:
            raise NotFoundException("Zone not found")
        return zone

    @staticmethod
    async def update_zone(db: AsyncSession, user: AuthenticatedUser, zone_id: str, data) -> CampusZone:
        zone = await ZoneService._get_zone(db, zone_id)
        await require_campus_scope(db, user, str(zone.campus_id), "You cannot update zones for a campus you do not manage")
        name = data.name.strip()
        if not name:
            raise BadRequestException("Zone name is required.")
        new_base = slugify(name)
        if new_base and new_base != zone.slug:  # keep URLs canonical when the name changes
            zone.slug = await ZoneService._unique_zone_slug(db, str(zone.campus_id), name, exclude_id=zone_id)
        zone.name = name
        zone.full_search_price = data.full_search_price
        zone.distance_category = data.distance_category
        await db.flush()
        return zone

    @staticmethod
    async def delete_zone(db: AsyncSession, user: AuthenticatedUser, zone_id: str) -> None:
        zone = await ZoneService._get_zone(db, zone_id)
        await require_campus_scope(db, user, str(zone.campus_id), "You cannot delete zones for a campus you do not manage")
        in_use = (await db.execute(
            select(func.count(Listing.id)).where(Listing.campus_id == zone.campus_id, Listing.area == zone.name)
        )).scalar_one()
        if in_use:
            raise BadRequestException(
                f'Cannot delete "{zone.name}": {in_use} hostel listing{"" if in_use == 1 else "s"} still use this area. '
                "Rename it instead, or remove the listings first."
            )
        await db.delete(zone)
        await db.flush()
