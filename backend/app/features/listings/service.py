import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser, check_ownership
from app.features.analytics.models import ListingView
from app.features.campuses.models import Campus
from app.features.listings.models import Agent, Listing, ListingImage, ListingRoomType
from app.features.listings.schemas import ListingCreate, ListingImageCreate, ListingRoomTypeCreate, ListingUpdate
from app.features.listings.verification import verify_listing
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
        property_type: Optional[str] = None,
        has_video: Optional[bool] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        is_active: bool = True,
        sort: Optional[str] = None,
    ) -> Tuple[List[Listing], int, dict]:
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
        if property_type:
            stmt = stmt.where(Listing.property_type == property_type)

        if has_video is True:
            stmt = stmt.where(Listing.youtube_id.is_not(None))
        elif has_video is False:
            stmt = stmt.where(Listing.youtube_id.is_(None))

        if min_price is not None:
            stmt = stmt.where(Listing.price >= min_price)
        if max_price is not None:
            stmt = stmt.where(Listing.price <= max_price)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        if sort == "views":
            view_sub = (
                select(ListingView.listing_id, func.count(ListingView.id).label("view_count"))
                .group_by(ListingView.listing_id)
                .subquery()
            )
            stmt = stmt.outerjoin(view_sub, view_sub.c.listing_id == Listing.id).order_by(
                func.coalesce(view_sub.c.view_count, 0).desc(),
                Listing.created_at.desc().nulls_last(),
            )
        elif sort == "newest":
            stmt = stmt.order_by(Listing.created_at.desc().nulls_last())
        else:
            stmt = stmt.order_by(
                Listing.sort_position.asc().nulls_last(),
                Listing.created_at.desc(),
            )

        stmt = stmt.offset(pagination.offset).limit(pagination.limit)

        result = await db.execute(stmt)
        listings = list(result.scalars().all())

        view_counts: dict = {}
        if listings:
            ids = [str(item.id) for item in listings]
            counts_result = await db.execute(
                select(ListingView.listing_id, func.count(ListingView.id).label("view_count"))
                .where(ListingView.listing_id.in_(ids))
                .group_by(ListingView.listing_id)
            )
            for listing_id, count in counts_result.all():
                view_counts[str(listing_id)] = count

        return listings, total, view_counts

    @staticmethod
    async def get_listing_by_id_or_slug(db: AsyncSession, id_or_slug: str) -> Optional[Listing]:
        try:
            parsed_id = uuid.UUID(id_or_slug)
            stmt = select(Listing).where((Listing.id == str(parsed_id)) | (Listing.slug == id_or_slug))
        except ValueError:
            stmt = select(Listing).where(Listing.slug == id_or_slug)
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
    async def _replace_images(
        db: AsyncSession,
        listing_id: str,
        images: List[ListingImageCreate],
    ) -> None:
        """Delete all existing images for a listing and insert new ones."""
        # Delete existing
        existing = await db.execute(
            select(ListingImage).where(ListingImage.listing_id == listing_id)
        )
        for img in existing.scalars().all():
            await db.delete(img)
        await db.flush()

        # Insert new
        for idx, img_data in enumerate(images):
            image_row = ListingImage(
                id=str(uuid.uuid4()),
                listing_id=listing_id,
                r2_url=img_data.r2_url,
                display_order=img_data.display_order if img_data.display_order else idx,
                category=img_data.category,
                blur_data_url=img_data.blur_data_url,
                width=img_data.width,
                height=img_data.height,
                format=img_data.format,
            )
            db.add(image_row)

    @staticmethod
    async def _replace_room_types(
        db: AsyncSession,
        listing_id: str,
        room_types: List[ListingRoomTypeCreate],
    ) -> None:
        """Delete all existing room types for a listing and insert new ones."""
        existing = await db.execute(
            select(ListingRoomType).where(ListingRoomType.listing_id == listing_id)
        )
        for rt in existing.scalars().all():
            await db.delete(rt)
        await db.flush()

        for rt_data in room_types:
            rt_row = ListingRoomType(
                id=str(uuid.uuid4()),
                listing_id=listing_id,
                room_type=rt_data.room_type,
                price=rt_data.price,
                is_available=rt_data.is_available,
                deposit=rt_data.deposit,
                furnishing_items=rt_data.furnishing_items or [],
                category=rt_data.category,
                occupancy=rt_data.occupancy,
                floor=rt_data.floor,
                size=rt_data.size,
            )
            db.add(rt_row)

    @staticmethod
    async def _auto_verify_listing(
        db: AsyncSession,
        listing: Listing,
        agent: Agent,
    ) -> None:
        """Run auto-verification against official DeKUT housing records."""
        try:
            result = verify_listing(
                title=listing.title,
                landlord_phone=listing.landlord_phone,
                agent_phone=agent.phone,
                agent_whatsapp=agent.whatsapp,
            )
            if result.verified or result.manual_review_needed or result.shared_contact_detected:
                # These columns may exist on listings table from migrations
                # but aren't in our SQLAlchemy model yet. Use raw update.
                from sqlalchemy import text, update as sa_update
                update_vals = {}
                if result.verified:
                    update_vals["verified"] = True
                    update_vals["verified_source"] = result.verified_source
                    update_vals["verified_date"] = result.verified_date
                if result.matched_hostel:
                    update_vals["discrepancy_review_needed"] = result.discrepancy_review_needed
                    update_vals["shared_contact_detected"] = result.shared_contact_detected
                    update_vals["manual_review_needed"] = result.manual_review_needed

                if update_vals:
                    set_clause = ", ".join(f"{k} = :{k}" for k in update_vals)
                    stmt = text(
                        f"UPDATE listings SET {set_clause} WHERE id = :listing_id"
                    )
                    await db.execute(stmt, {**update_vals, "listing_id": listing.id})
        except Exception:
            # Auto-verification is best-effort, never block the main flow
            pass

    @staticmethod
    async def create_listing(
        db: AsyncSession,
        user: AuthenticatedUser,
        data: ListingCreate,
    ) -> Listing:
        agent = await ListingService.resolve_agent_for_user(db, user)

        # Update agent WhatsApp if provided
        if data.agent_whatsapp and data.agent_whatsapp.strip():
            agent.whatsapp = data.agent_whatsapp.strip()

        base_slug = slugify(data.title)
        slug = f"{base_slug}-{str(uuid.uuid4())[:8]}"

        listing = Listing(
            id=str(uuid.uuid4()),
            title=data.title,
            slug=slug,
            description=data.description,
            property_type=data.property_type,
            price=data.price,
            location=data.location,
            county=data.county,
            area=data.area,
            specific_location=data.specific_location,
            landlord_phone=data.landlord_phone,
            youtube_id=data.youtube_id,
            is_youtube_shorts=data.is_youtube_shorts,
            bathroom_type=data.bathroom_type,
            distance_to_campus=data.distance_to_campus,
            distance_category=data.distance_category,
            security_type=data.security_type,
            electricity_included=data.electricity_included,
            water_included=data.water_included,
            wifi_included=data.wifi_included,
            hot_water_included=data.hot_water_included,
            cooking_gas_included=data.cooking_gas_included,
            room_type=data.room_type,
            gender=data.gender,
            price_single=data.price_single,
            price_sharing=data.price_sharing,
            pays_commission=data.pays_commission,
            amenities=data.amenities or [],
            latitude=data.latitude,
            longitude=data.longitude,
            agent_id=agent.id,
            campus_id=data.campus_id or user.managed_campus_id,
            zone_id=data.zone_id,
            is_active=True,
            is_full=False,
            rating=0.0,
            views=0,
            created_at=datetime.now(timezone.utc),
        )
        db.add(listing)
        await db.flush()

        # Add room types
        if data.room_types:
            await ListingService._replace_room_types(db, listing.id, data.room_types)

        # Add images — prefer structured ListingImageCreate, fall back to flat URLs
        if data.images:
            await ListingService._replace_images(db, listing.id, data.images)
        elif data.image_urls:
            image_creates = [
                ListingImageCreate(r2_url=url, display_order=idx)
                for idx, url in enumerate(data.image_urls)
            ]
            await ListingService._replace_images(db, listing.id, image_creates)

        await db.flush()

        # Auto-verify against official DeKUT records (best-effort)
        await ListingService._auto_verify_listing(db, listing, agent)

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

        # Update agent WhatsApp if provided
        if data.agent_whatsapp and data.agent_whatsapp.strip() and listing.agent:
            listing.agent.whatsapp = data.agent_whatsapp.strip()

        # Extract nested relations before applying scalar fields
        update_data = data.model_dump(exclude_unset=True, exclude={"images", "room_types", "agent_whatsapp"})
        for field_name, val in update_data.items():
            setattr(listing, field_name, val)

        listing.updated_at = datetime.now(timezone.utc)

        # Replace images if provided
        if data.images is not None:
            await ListingService._replace_images(db, listing.id, data.images)

        # Replace room types if provided
        if data.room_types is not None:
            await ListingService._replace_room_types(db, listing.id, data.room_types)

        await db.flush()

        # Re-run auto-verification (in case landlord_phone changed)
        if listing.agent:
            await ListingService._auto_verify_listing(db, listing, listing.agent)

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
    async def toggle_listing_active(
        db: AsyncSession,
        listing_id: str,
        user: AuthenticatedUser,
        is_active: bool,
    ) -> Listing:
        listing = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        if not listing:
            raise NotFoundException(f"Listing '{listing_id}' not found")

        owner_user_id = listing.agent.user_id if listing.agent else None
        check_ownership(user, owner_user_id or listing.agent_id)

        listing.is_active = is_active
        await db.flush()
        return listing

    @staticmethod
    async def toggle_listing_commission(
        db: AsyncSession,
        listing_id: str,
        user: AuthenticatedUser,
        pays_commission: bool,
    ) -> Listing:
        listing = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        if not listing:
            raise NotFoundException(f"Listing '{listing_id}' not found")

        owner_user_id = listing.agent.user_id if listing.agent else None
        check_ownership(user, owner_user_id or listing.agent_id)

        listing.pays_commission = pays_commission
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
