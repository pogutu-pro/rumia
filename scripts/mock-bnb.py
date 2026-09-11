#!/usr/bin/env python3
"""Create or remove a clearly marked RumiaBnB demo listing.

Usage:
  backend/.venv/bin/python scripts/mock-bnb.py create --agent-id <agent-uuid>
  backend/.venv/bin/python scripts/mock-bnb.py delete

The delete command only removes listings carrying MOCK_BNB_MARKER.
"""

import argparse
import asyncio
import os
import sys
import uuid
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT / "backend")
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import delete, select  # noqa: E402

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.features.campuses.models import Campus  # noqa: E402
from app.features.bnb.models import BnbDetails  # noqa: E402
from app.features.listings.models import Agent, Listing, ListingImage  # noqa: E402

MOCK_BNB_MARKER = "[MOCK_BNB_RUMIA]"
MOCK_SLUG = "mock-bnb-rumia-demo"

MOCK_IMAGES = [
    {
        "r2_url": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=85&w=1600&auto=format&fit=crop",
        "category": "Living area",
        "display_order": 0,
        "width": 1600,
        "height": 1067,
        "format": "jpg",
    },
    {
        "r2_url": "https://images.unsplash.com/photo-1560185008-b033106af5c3?q=85&w=1600&auto=format&fit=crop",
        "category": "Bedroom",
        "display_order": 1,
        "width": 1600,
        "height": 1067,
        "format": "jpg",
    },
    {
        "r2_url": "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=85&w=1600&auto=format&fit=crop",
        "category": "Kitchen",
        "display_order": 2,
        "width": 1600,
        "height": 1067,
        "format": "jpg",
    },
]


async def create(agent_id: str | None) -> None:
    async with AsyncSessionLocal() as session:
        existing = await session.scalar(
            select(Listing).where(Listing.slug == MOCK_SLUG)
        )
        if existing:
            print(f"Mock listing already exists: {existing.id}")
            print(f"View: /bnb/{existing.id}")
            return

        if agent_id:
            agent = await session.scalar(select(Agent).where(Agent.id == agent_id))
        else:
            agents = list((await session.scalars(select(Agent).order_by(Agent.created_at))).all())
            if len(agents) != 1:
                raise SystemExit(
                    "Pass --agent-id (or MOCK_BNB_AGENT_ID) when the database has zero or multiple agents."
                )
            agent = agents[0]

        if not agent:
            raise SystemExit(f"Agent not found: {agent_id}")

        campus = await session.scalar(select(Campus).where(Campus.slug == "dekut"))
        if not campus:
            raise SystemExit("Required campus 'dekut' was not found.")

        listing_id = str(uuid.uuid4())
        listing = Listing(
            id=listing_id,
            title=f"{MOCK_BNB_MARKER} Cedar House Retreat",
            slug=MOCK_SLUG,
            description=(
                "A bright, comfortable short-stay home for weekends, family visits, "
                "and work trips in Nyeri. The mock listing demonstrates the complete "
                "RumiaBnB guest experience."
            ),
            property_type="short_stay",
            price=2500,
            location="Nyeri",
            county="Nyeri",
            area="Rware",
            specific_location="A short walk from Nyeri town",
            latitude=-0.4197,
            longitude=36.9553,
            amenities=["Wi-Fi", "Parking", "Kitchen", "Hot shower", "Workspace", "TV"],
            is_active=True,
            agent_id=agent.id,
            campus_id=campus.id,
        )
        session.add(listing)
        await session.flush()
        session.add_all(
            [
                ListingImage(listing_id=listing_id, **image)
                for image in MOCK_IMAGES
            ]
        )
        session.add(
            BnbDetails(
                listing_id=listing_id,
                listing_type="entire_place",
                max_guests=4,
                bedrooms=2,
                bathrooms=1,
                bed_config=[
                    {"type": "Queen bed", "qty": 1},
                    {"type": "Sofa bed", "qty": 1},
                ],
                price_unit="night",
                min_stay_nights=1,
                max_stay_nights=14,
                cleaning_fee=500,
                security_deposit=2000,
                extra_guest_fee=500,
                available_from=date.today(),
                check_in_time="14:00",
                check_out_time="10:00",
                advance_notice_hours=12,
                house_rules={
                    "smoking": False,
                    "pets": False,
                    "parties": False,
                    "visitors": True,
                    "children": True,
                    "quiet_hours": "22:00-06:00",
                },
                custom_rules="Please leave the kitchen and shared spaces tidy.",
                guest_suitability=["Couples", "Families", "Business travelers"],
                nearby_landmark="Nyeri town centre",
            )
        )
        await session.commit()
        print(f"Created mock listing: {listing_id}")
        print(f"View: /bnb/{listing_id}")
        print("Delete with: backend/.venv/bin/python scripts/mock-bnb.py delete")


async def delete_mock() -> None:
    async with AsyncSessionLocal() as session:
        listings = list(
            (
                await session.scalars(
                    select(Listing).where(Listing.title.like(f"{MOCK_BNB_MARKER}%"))
                )
            ).all()
        )
        listing_ids = [listing.id for listing in listings]
        if not listing_ids:
            print("No mock RumiaBnB listings found.")
            return

        await session.execute(delete(BnbDetails).where(BnbDetails.listing_id.in_(listing_ids)))
        await session.execute(delete(ListingImage).where(ListingImage.listing_id.in_(listing_ids)))
        await session.execute(delete(Listing).where(Listing.id.in_(listing_ids)))
        await session.commit()
        print(f"Deleted {len(listing_ids)} mock RumiaBnB listing(s).")


async def list_agents() -> None:
    async with AsyncSessionLocal() as session:
        agents = list((await session.scalars(select(Agent).order_by(Agent.created_at))).all())
        if not agents:
            print("No agents found.")
            return
        for agent in agents:
            print(f"{agent.id}\t{agent.name}\t{agent.status}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    create_parser = subparsers.add_parser("create", help="Create the demo listing")
    create_parser.add_argument(
        "--agent-id",
        default=os.getenv("MOCK_BNB_AGENT_ID"),
        help="Existing agent UUID; or set MOCK_BNB_AGENT_ID.",
    )
    subparsers.add_parser("delete", help="Delete only the marked demo listing")
    subparsers.add_parser("agents", help="List agent IDs available for the demo listing")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    if args.command == "create":
        await create(args.agent_id)
    elif args.command == "delete":
        await delete_mock()
    else:
        await list_agents()


if __name__ == "__main__":
    asyncio.run(main())
