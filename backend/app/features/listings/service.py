import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, select, union_all
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestException, ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser, check_campus_scope
from app.features.analytics.models import ListingView, ListingViewDailyRollup
from app.features.campuses.models import Campus
from app.features.profiles.models import UserProfile
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
    async def assert_can_manage(db: AsyncSession, user: AuthenticatedUser, listing: Listing) -> None:
        """The listing's owning agent, an admin, or a manager whose campus/region covers it."""
        owner_user_id = listing.agent.user_id if listing.agent else None
        if user.is_admin:
            return
        if owner_user_id and str(owner_user_id) == user.id:
            if getattr(listing.agent, "status", "active") == "suspended":
                raise ForbiddenException("Your agent account is suspended. Contact your campus manager.")
            return
        if user.role == "manager" and listing.campus_id and await check_campus_scope(user, str(listing.campus_id), db):
            return
        raise ForbiddenException("You do not have permission to manage this listing")

    @staticmethod
    def _all_time_view_counts(listing_ids: Optional[List[str]] = None):
        live_counts = select(
            ListingView.listing_id.label("listing_id"),
            func.count(ListingView.id).label("view_count"),
        ).where(ListingView.listing_id.is_not(None))
        rollup_counts = select(
            ListingViewDailyRollup.listing_id.label("listing_id"),
            func.sum(ListingViewDailyRollup.view_count).label("view_count"),
        )

        if listing_ids is not None:
            live_counts = live_counts.where(ListingView.listing_id.in_(listing_ids))
            rollup_counts = rollup_counts.where(ListingViewDailyRollup.listing_id.in_(listing_ids))

        event_counts = union_all(
            live_counts.group_by(ListingView.listing_id),
            rollup_counts.group_by(ListingViewDailyRollup.listing_id),
        ).subquery()

        return (
            select(
                event_counts.c.listing_id,
                func.sum(event_counts.c.view_count).label("view_count"),
            )
            .group_by(event_counts.c.listing_id)
            .subquery()
        )

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
        ids: Optional[List[str]] = None,
        agent_id: Optional[str] = None,
    ) -> Tuple[List[Listing], int, dict]:
        conditions = [Listing.is_active == is_active]
        join_specs: List[Tuple] = []

        if ids is not None:
            conditions.append(Listing.id.in_(ids))
        if agent_id:
            conditions.append(Listing.agent_id == agent_id)

        if campus_id:
            conditions.append(Listing.campus_id == campus_id)
        elif campus_slug:
            join_specs.append((Campus, Listing.campus_id == Campus.id))
            conditions.append(Campus.slug == campus_slug)

        if zone_id:
            conditions.append(Listing.zone_id == zone_id)
        elif zone_slug:
            join_specs.append((CampusZone, Listing.zone_id == CampusZone.id))
            conditions.append(CampusZone.slug == zone_slug)

        if area:
            conditions.append(Listing.area.ilike(f"%{area}%"))
        if county:
            conditions.append(Listing.county.ilike(f"%{county}%"))
        if property_type:
            conditions.append(Listing.property_type == property_type)

        if has_video is True:
            conditions.append(Listing.youtube_id.is_not(None))
        elif has_video is False:
            conditions.append(Listing.youtube_id.is_(None))

        if min_price is not None:
            conditions.append(Listing.price >= min_price)
        if max_price is not None:
            conditions.append(Listing.price <= max_price)

        count_stmt = select(func.count(Listing.id)).select_from(Listing)
        for target, onclause in join_specs:
            count_stmt = count_stmt.join(target, onclause)
        count_stmt = count_stmt.where(*conditions)
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        stmt = select(Listing).where(*conditions)
        for target, onclause in join_specs:
            stmt = stmt.join(target, onclause)

        if sort == "views":
            view_sub = ListingService._all_time_view_counts()
            view_count = func.coalesce(view_sub.c.view_count, 0)
            stmt = stmt.add_columns(view_count.label("view_count"))
            stmt = stmt.outerjoin(view_sub, view_sub.c.listing_id == Listing.id).order_by(
                view_count.desc(),
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

        view_counts: dict = {}
        result = await db.execute(stmt)
        if sort == "views":
            rows = result.all()
            listings = [row[0] for row in rows]
            view_counts = {str(row[0].id): int(row[1]) for row in rows}
        else:
            listings = list(result.scalars().all())

        if listings and sort != "views":
            ids = [str(item.id) for item in listings]
            counts_sub = ListingService._all_time_view_counts(ids)
            counts_result = await db.execute(select(counts_sub.c.listing_id, counts_sub.c.view_count))
            for listing_id, count in counts_result.all():
                view_counts[str(listing_id)] = int(count)

        return listings, total, view_counts

    @staticmethod
    async def get_listing_by_id_or_slug(db: AsyncSession, id_or_slug: str) -> Optional[Listing]:
        stmt = select(Listing).options(
            selectinload(Listing.agent),
            selectinload(Listing.images),
            selectinload(Listing.room_types),
        )
        try:
            parsed_id = uuid.UUID(id_or_slug)
            stmt = stmt.where((Listing.id == str(parsed_id)) | (Listing.slug == id_or_slug))
        except ValueError:
            stmt = stmt.where(Listing.slug == id_or_slug)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def resolve_agent_for_user(db: AsyncSession, user: AuthenticatedUser) -> Agent:
        """Find or create the Agent record that owns listings created by this user.

        Staff (manager/admin) get one on demand, built from their own profile. A listing is never
        attributed to another agent, and the contact number seekers see is always a real one.
        """
        stmt = select(Agent).where(Agent.user_id == user.id)
        result = await db.execute(stmt)
        agent = result.scalar_one_or_none()
        if agent:
            if getattr(agent, "status", "active") == "suspended":
                raise ForbiddenException("Your agent account is suspended. Contact your campus manager.")
            return agent

        # Only staff get an agent record on demand; everyone else must be approved as an agent.
        if user.role not in ("manager", "admin", "super_admin"):
            raise ForbiddenException("Only approved agents can manage listings")

        profile = (await db.execute(
            select(UserProfile.full_name, UserProfile.phone, UserProfile.campus_id).where(UserProfile.id == user.id)
        )).fetchone()
        phone = (profile.phone or "").strip() if profile else ""
        if not phone:
            raise BadRequestException(
                "Add your phone number to your profile before creating listings, so seekers can reach you."
            )
        # agents.campus_id is NOT NULL
        campus_id = user.managed_campus_id or (str(profile.campus_id) if profile and profile.campus_id else None)
        if not campus_id:
            raise BadRequestException("Choose a campus for your profile before creating listings.")

        agent = Agent(
            id=str(uuid.uuid4()),
            name=(profile.full_name if profile and profile.full_name else None)
            or (user.email.split("@")[0] if user.email else "Agent"),
            phone=phone,
            whatsapp=phone,
            user_id=user.id,
            campus_id=campus_id,
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
                image_upload_id=img_data.image_upload_id,
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
            mpesa_details=data.mpesa_details,
            proximity_description=data.proximity_description,
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
            # Agents list only into their own campus; the client-sent campus_id is honoured for admins.
            campus_id=(data.campus_id if user.is_admin and data.campus_id else (agent.campus_id or user.managed_campus_id)),
            zone_id=data.zone_id,
            is_active=data.is_active,
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
        await ListingService.assert_can_manage(db, user, listing)

        # A manager editing someone else's listing may only pick the campus's configured areas.
        owner_user_id = listing.agent.user_id if listing.agent else None
        is_manager_edit = (not user.is_admin) and user.role == "manager" and str(owner_user_id or "") != user.id
        if is_manager_edit and data.area is not None:
            from app.features.zones.models import CampusZone

            zones = (await db.execute(select(CampusZone.name).where(CampusZone.campus_id == listing.campus_id))).scalars().all()
            canonical = next((z for z in zones if z.strip().lower() == data.area.strip().lower()), None)
            if canonical is None:
                raise BadRequestException(
                    "Please choose a valid hostel area for this campus. Only the manager-configured areas are allowed."
                )
            data.area = canonical.strip()

        # Update agent WhatsApp if provided
        if data.agent_whatsapp and data.agent_whatsapp.strip() and listing.agent:
            listing.agent.whatsapp = data.agent_whatsapp.strip()

        # Extract nested relations before applying scalar fields
        # Moving a listing to another campus is admin-only.
        excluded = {"images", "room_types", "agent_whatsapp"} | (set() if user.is_admin else {"campus_id"})
        update_data = data.model_dump(exclude_unset=True, exclude=excluded)
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

        await ListingService.assert_can_manage(db, user, listing)

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

        await ListingService.assert_can_manage(db, user, listing)

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

        await ListingService.assert_can_manage(db, user, listing)
        if listing.commission_locked_by_admin and not user.is_admin:
            raise ForbiddenException("This listing's commission setting is locked by an administrator")

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

        await ListingService.assert_can_manage(db, user, listing)

        if listing.property_type == "short_stay":
            from app.features.images.service import ImageService

            await ImageService.cleanup_listing_uploads(db, listing.id)

        await db.delete(listing)
        await db.flush()
