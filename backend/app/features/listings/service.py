import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser, check_ownership
from app.features.campuses.models import Campus
from app.features.listings.models import Agent, Listing, ListingImage, ListingRoomType
from app.features.listings.schemas import ListingCreate, ListingUpdate
from app.features.zones.models import CampusZone


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


class ListingService:
    @staticmethod
    async def get_listings_feed(
        db: AsyncSession,
        pagination: PaginationParams,
        campus_slug: Optional[str] = None,
        campus_id: Optional[str] = None,
        zone_slug: Optional[str] = None,
        zone_id: Optional[str] = None,
        area: Optional[str] = None,
        county: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        is_active: bool = True,
    ) -> Tuple[List[Listing], int]:
        stmt = select(Listing).where(Listing.is_active == is_active)

        if campus_id:
            stmt = stmt.where(Listing.campus_id == campus_id)
        elif campus_slug:
            stmt = stmt.join(Campus, Listing.campus_id == Campus.id).where(Campus.slug == campus_slug)

        if zone_id:
            stmt = stmt.where(Listing.zone_id == zone_id)
        elif zone_slug:
            stmt = stmt.join(CampusZone, Listing.zone_id == CampusZone.id).where(CampusZone.slug == zone_slug)

        if area:
            stmt = stmt.where(Listing.area.ilike(f"%{area}%"))
        if county:
            stmt = stmt.where(Listing.county.ilike(f"%{county}%"))

        if min_price is not None:
            stmt = stmt.where(Listing.price >= min_price)
        if max_price is not None:
            stmt = stmt.where(Listing.price <= max_price)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        stmt = stmt.order_by(
            Listing.sort_order.asc().nulls_last(),
            Listing.created_at.desc(),
        ).offset(pagination.offset).limit(pagination.limit)

        result = await db.execute(stmt)
        listings = list(result.scalars().all())
        return listings, total

    @staticmethod
    async def get_listing_by_id_or_slug(db: AsyncSession, id_or_slug: str) -> Optional[Listing]:
        stmt = select(Listing).where(
            (Listing.id == id_or_slug) | (Listing.slug == id_or_slug)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def resolve_agent_for_user(db: AsyncSession, user: AuthenticatedUser) -> Agent:
        """Find or create Agent record for user."""
        stmt = select(Agent).where(Agent.user_id == user.id)
        result = await db.execute(stmt)
        agent = result.scalar_one_or_none()

        if not agent and user.is_admin:
            # Fallback for admin user without dedicated agent row
            stmt_any = select(Agent).limit(1)
            any_result = await db.execute(stmt_any)
            agent = any_result.scalar_one_or_none()

        if not agent:
            # Create default agent record for agent user
            agent = Agent(
                id=str(uuid.uuid4()),
                name=user.email.split("@")[0] if user.email else "Agent",
                phone="+254700000000",
                whatsapp="+254700000000",
                user_id=user.id,
                campus_id=user.managed_campus_id,
            )
            db.add(agent)
            await db.flush()

        return agent

    @staticmethod
    async def create_listing(
        db: AsyncSession,
        user: AuthenticatedUser,
        data: ListingCreate,
    ) -> Listing:
        agent = await ListingService.resolve_agent_for_user(db, user)

        base_slug = slugify(data.title)
        slug = f"{base_slug}-{str(uuid.uuid4())[:8]}"

        listing = Listing(
            id=str(uuid.uuid4()),
            title=data.title,
            slug=slug,
            description=data.description,
            price=data.price,
            location=data.location,
            county=data.county,
            area=data.area,
            specific_location=data.specific_location,
            landlord_phone=data.landlord_phone,
            youtube_id=data.youtube_id,
            bathroom_type=data.bathroom_type,
            distance_to_campus=data.distance_to_campus,
            security_type=data.security_type,
            electricity_included=data.electricity_included,
            water_included=data.water_included,
            wifi_included=data.wifi_included,
            amenities=data.amenities or [],
            latitude=data.latitude,
            longitude=data.longitude,
            agent_id=agent.id,
            campus_id=data.campus_id or user.managed_campus_id,
            zone_id=data.zone_id,
            is_active=True,
            # Populate defaults explicitly so model_validate works without a DB round-trip
            is_full=False,
            rating=0.0,
            views=0,
            created_at=datetime.now(timezone.utc),
        )
        db.add(listing)
        await db.flush()

        # Add room types
        for rt in data.room_types:
            room_type_row = ListingRoomType(
                id=str(uuid.uuid4()),
                listing_id=listing.id,
                room_type=rt.room_type,
                price=rt.price,
                is_available=rt.is_available,
            )
            db.add(room_type_row)

        # Add images
        for idx, url in enumerate(data.image_urls):
            image_row = ListingImage(
                id=str(uuid.uuid4()),
                listing_id=listing.id,
                r2_url=url,
                display_order=idx,
            )
            db.add(image_row)

        await db.flush()
        return listing

    @staticmethod
    async def update_listing(
        db: AsyncSession,
        listing_id: str,
        user: AuthenticatedUser,
        data: ListingUpdate,
    ) -> Listing:
        listing = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        if not listing:
            raise NotFoundException(f"Listing '{listing_id}' not found")

        # Verify owner or admin
        owner_user_id = listing.agent.user_id if listing.agent else None
        check_ownership(user, owner_user_id or listing.agent_id)

        update_data = data.model_dump(exclude_unset=True)
        for field, val in update_data.items():
            setattr(listing, field, val)

        await db.flush()
        return listing

    @staticmethod
    async def toggle_listing_full(
        db: AsyncSession,
        listing_id: str,
        user: AuthenticatedUser,
        is_full: bool,
    ) -> Listing:
        listing = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        if not listing:
            raise NotFoundException(f"Listing '{listing_id}' not found")

        owner_user_id = listing.agent.user_id if listing.agent else None
        check_ownership(user, owner_user_id or listing.agent_id)

        listing.is_full = is_full
        await db.flush()
        return listing

    @staticmethod
    async def delete_listing(
        db: AsyncSession,
        listing_id: str,
        user: AuthenticatedUser,
    ) -> None:
        listing = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        if not listing:
            raise NotFoundException(f"Listing '{listing_id}' not found")

        owner_user_id = listing.agent.user_id if listing.agent else None
        check_ownership(user, owner_user_id or listing.agent_id)

        await db.delete(listing)
        await db.flush()
