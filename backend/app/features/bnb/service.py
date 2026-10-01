import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.pagination import PaginationParams
from app.core.security import AuthenticatedUser, check_ownership
from app.features.bnb.models import BnbDetails
from app.features.bnb.schemas import BnbDetailsUpdate, BnbListingCreate, BnbListingUpdate
from app.features.listings.models import Listing, ListingImage
from app.features.listings.schemas import ListingCreate, ListingImageCreate, ListingUpdate
from app.features.listings.service import ListingService


class BnbService:
    @staticmethod
    async def create_bnb_listing(
        db: AsyncSession,
        user: AuthenticatedUser,
        data: BnbListingCreate,
    ) -> Tuple[Listing, BnbDetails]:
        agent = await ListingService.resolve_agent_for_user(db, user)
        listing_create = ListingCreate(
            title=data.title,
            description=data.description,
            property_type="short_stay",
            price=data.price,
            location=data.location,
            county=data.county,
            area=data.area,
            specific_location=data.specific_location,
            latitude=data.latitude,
            longitude=data.longitude,
            campus_id=agent.campus_id or user.managed_campus_id,
            amenities=data.amenities,
            is_active=data.is_active,
            images=[
                ListingImageCreate(
                    r2_url=img.get("r2_url", img.get("url", "")),
                    image_upload_id=img.get("image_upload_id") or img.get("imageUploadId"),
                    display_order=img.get("display_order", idx),
                    category=img.get("category"),
                    blur_data_url=img.get("blur_data_url") or img.get("blurDataUrl"),
                    width=img.get("width"),
                    height=img.get("height"),
                    format=img.get("format"),
                )
                for idx, img in enumerate(data.images)
            ],
            agent_whatsapp=data.agent_whatsapp,
        )
        listing = await ListingService.create_listing(db=db, user=user, data=listing_create)

        bnb = await BnbService._upsert_bnb_details(db, listing.id, data.bnb)
        reloaded = await ListingService.get_listing_by_id_or_slug(db, listing.id)
        return reloaded or listing, bnb

    @staticmethod
    async def update_bnb_listing(
        db: AsyncSession,
        listing_id: str,
        user: AuthenticatedUser,
        data: BnbListingUpdate,
    ) -> Tuple[Listing, BnbDetails]:
        listing = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        if not listing:
            raise NotFoundException(f"BnB listing '{listing_id}' not found")
        if listing.property_type != "short_stay":
            raise NotFoundException(f"Listing '{listing_id}' is not a BnB listing")

        owner_user_id = listing.agent.user_id if listing.agent else None
        check_ownership(user, owner_user_id or listing.agent_id)

        listing_update_data: dict = {}
        for field in ("title", "description", "price", "location", "county", "area",
                      "specific_location", "latitude", "longitude", "amenities", "is_active"):
            val = getattr(data, field, None)
            if val is not None:
                listing_update_data[field] = val

        if data.images is not None:
            listing_update_data["images"] = [
                ListingImageCreate(
                    r2_url=img.get("r2_url", img.get("url", "")),
                    image_upload_id=img.get("image_upload_id") or img.get("imageUploadId"),
                    display_order=img.get("display_order", idx),
                    category=img.get("category"),
                    blur_data_url=img.get("blur_data_url") or img.get("blurDataUrl"),
                    width=img.get("width"),
                    height=img.get("height"),
                    format=img.get("format"),
                )
                for idx, img in enumerate(data.images)
            ]

        if data.agent_whatsapp:
            listing_update_data["agent_whatsapp"] = data.agent_whatsapp

        if listing_update_data:
            listing_update = ListingUpdate(**listing_update_data)
            listing = await ListingService.update_listing(
                db=db, listing_id=listing_id, user=user, data=listing_update
            )

        bnb = await BnbService._upsert_bnb_details(
            db,
            listing_id,
            data.bnb or BnbDetailsUpdate(),
            partial=True,
        )
        reloaded = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        return reloaded or listing, bnb

    @staticmethod
    async def get_bnb_listing_for_edit(
        db: AsyncSession,
        listing_id: str,
        user: AuthenticatedUser,
    ) -> Tuple[Listing, Optional[BnbDetails]]:
        """Load an active or inactive BnB for its owner or an admin."""
        from app.features.listings.models import Agent

        listing = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        if not listing:
            raise NotFoundException(f"BnB listing '{listing_id}' not found")
        if listing.property_type != "short_stay":
            raise NotFoundException(f"Listing '{listing_id}' is not a BnB listing")

        if not user.is_admin:
            agent_result = await db.execute(
                select(Agent).where(Agent.user_id == user.id)
            )
            agent = agent_result.scalar_one_or_none()
            if not agent or str(agent.id) != str(listing.agent_id):
                raise ForbiddenException("You do not own this resource")

        details_result = await db.execute(
            select(BnbDetails).where(BnbDetails.listing_id == listing.id)
        )
        return listing, details_result.scalar_one_or_none()

    @staticmethod
    async def get_bnb_listing(
        db: AsyncSession,
        listing_id: str,
    ) -> Tuple[Listing, Optional[BnbDetails]]:
        listing = await ListingService.get_listing_by_id_or_slug(db, listing_id)
        if not listing:
            raise NotFoundException(f"BnB listing '{listing_id}' not found")
        if listing.property_type != "short_stay":
            raise NotFoundException(f"Listing '{listing_id}' is not a BnB listing")

        result = await db.execute(
            select(BnbDetails).where(BnbDetails.listing_id == listing.id)
        )
        bnb = result.scalar_one_or_none()
        return listing, bnb

    @staticmethod
    async def get_agent_bnb_listings(
        db: AsyncSession,
        user: AuthenticatedUser,
        pagination: PaginationParams,
    ) -> Tuple[List[Listing], int]:
        from sqlalchemy import func
        from app.features.listings.models import Agent

        agent_stmt = select(Agent).where(Agent.user_id == user.id)
        agent_result = await db.execute(agent_stmt)
        agent = agent_result.scalar_one_or_none()
        if not agent:
            return [], 0

        stmt = (
            select(Listing)
            .where(Listing.agent_id == agent.id)
            .where(Listing.property_type == "short_stay")
            .order_by(Listing.created_at.desc())
        )

        count_result = await db.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total = count_result.scalar_one()

        stmt = stmt.offset(pagination.offset).limit(pagination.limit)
        result = await db.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def _upsert_bnb_details(
        db: AsyncSession,
        listing_id: str,
        data: object,
        *,
        partial: bool = False,
    ) -> BnbDetails:
        result = await db.execute(
            select(BnbDetails).where(BnbDetails.listing_id == listing_id)
        )
        bnb = result.scalar_one_or_none()

        bnb_fields = {
            "listing_type", "max_guests", "bedrooms", "bathrooms", "bed_config",
            "price_unit", "min_stay_nights", "max_stay_nights", "cleaning_fee",
            "security_deposit", "extra_guest_fee", "available_from", "available_until",
            "check_in_time", "check_out_time", "advance_notice_hours",
            "house_rules", "custom_rules", "guest_suitability", "nearby_landmark",
        }

        if bnb is None:
            bnb = BnbDetails(listing_id=listing_id)
            db.add(bnb)

        if hasattr(data, "model_dump"):
            values = data.model_dump(exclude_unset=partial)
        else:
            values = {}

        for field, val in values.items():
            if field not in bnb_fields:
                continue
            if val is None and not partial:
                continue
            # Pydantic models → dict for JSONB fields
            if hasattr(val, "model_dump"):
                val = val.model_dump()
            elif isinstance(val, list) and val and hasattr(val[0], "model_dump"):
                val = [item.model_dump() for item in val]
            setattr(bnb, field, val)

        bnb.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return bnb
