"""RumiaBnB hosts: the organisations behind short stays, invite links that hand a team-managed host to its owner."""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConflictException, NotFoundException
from app.features.stays.service import hash_token, require_uuid

INVITE_DAYS = 14
# Logins that admin "Create agent" makes for hosts who have no account yet (see AdminConsoleService.create_agent).
PLACEHOLDER_EMAIL_SUFFIX = "@agents.rumia.co.ke"

# Organisations with at least one short stay, through either model (projected property or legacy agent).
HOST_ORGS = """
    SELECT o.id, o.name, o.slug, o.claimed_at
    FROM lister_orgs o
    WHERE EXISTS (
      SELECT 1 FROM listings l
      WHERE l.property_type = 'short_stay'
        AND (l.agent_id = o.legacy_agent_id OR l.id IN (SELECT legacy_listing_id FROM properties WHERE org_id = o.id))
    )
"""


async def _listings(db: AsyncSession, org_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    if not org_ids:
        return {}
    rows = (
        await db.execute(
            text(
                """
                SELECT o.id AS org_id, l.id, l.title, l.slug, l.is_active
                FROM lister_orgs o JOIN listings l
                  ON l.property_type = 'short_stay'
                 AND (l.agent_id = o.legacy_agent_id OR l.id IN (SELECT legacy_listing_id FROM properties WHERE org_id = o.id))
                WHERE o.id = ANY(CAST(:o AS uuid[]))
                ORDER BY l.title
                """
            ),
            {"o": org_ids},
        )
    ).mappings().all()
    out: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        out.setdefault(str(r["org_id"]), []).append({"id": str(r["id"]), "title": r["title"], "slug": r["slug"], "is_active": r["is_active"]})
    return out


async def list_hosts(db: AsyncSession) -> List[Dict[str, Any]]:
    """Every RumiaBnB host for staff: places, whether the owner has a login, current fee terms, open requests."""
    orgs = (
        await db.execute(
            text(
                HOST_ORGS
                + """
                ORDER BY o.name
                """
            )
        )
    ).mappings().all()
    ids = [str(o["id"]) for o in orgs]
    listings = await _listings(db, ids)
    extra = {}
    if ids:
        rows = (
            await db.execute(
                text(
                    """
                    SELECT o.id,
                      (SELECT count(*) FROM org_members m JOIN auth.users u ON u.id = m.user_id
                        WHERE m.org_id = o.id AND u.email NOT LIKE :ph) AS owners,
                      (SELECT count(*) FROM stay_requests r WHERE r.org_id = o.id AND r.status IN ('requested', 'disputed')) AS open_requests,
                      (SELECT row_to_json(a) FROM (
                         SELECT fee_percent, fee_min, fee_night_cap, effective_from FROM host_agreements
                         WHERE org_id = o.id AND effective_from <= current_date AND (effective_to IS NULL OR effective_to >= current_date)
                         ORDER BY effective_from DESC LIMIT 1) a) AS agreement
                    FROM lister_orgs o WHERE o.id = ANY(CAST(:o AS uuid[]))
                    """
                ),
                {"o": ids, "ph": f"%{PLACEHOLDER_EMAIL_SUFFIX}"},
            )
        ).mappings().all()
        extra = {str(r["id"]): r for r in rows}
    return [
        {
            "id": str(o["id"]), "name": o["name"], "slug": o["slug"], "claimed_at": o["claimed_at"],
            "has_login": bool(extra.get(str(o["id"]), {}).get("owners")),
            "open_requests": int(extra.get(str(o["id"]), {}).get("open_requests") or 0),
            "agreement": extra.get(str(o["id"]), {}).get("agreement"),
            "listings": listings.get(str(o["id"]), []),
        }
        for o in orgs
    ]


async def create_invite(db: AsyncSession, org_id: str, staff_id: str) -> Dict[str, Any]:
    require_uuid(org_id, "Host not found.")
    if not (await db.execute(text("SELECT 1 FROM lister_orgs WHERE id = CAST(:o AS uuid)"), {"o": org_id})).first():
        raise NotFoundException("Host not found.")
    token = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc) + timedelta(days=INVITE_DAYS)
    await db.execute(
        text("INSERT INTO host_invites (org_id, token_hash, created_by, expires_at) VALUES (CAST(:o AS uuid), :h, CAST(:u AS uuid), :e)"),
        {"o": org_id, "h": hash_token(token), "u": staff_id, "e": expires},
    )
    return {"url": f"{settings.BNB_PUBLIC_URL.rstrip('/')}/host/claim?token={token}", "expires_at": expires}


async def claim(db: AsyncSession, token: str, user_id: str) -> Dict[str, Any]:
    """The signed-in person becomes an owner of the invited organisation (and takes over its placeholder agent)."""
    inv = (
        await db.execute(
            text(
                """
                SELECT i.id, i.org_id, i.expires_at, i.used_at, i.used_by, o.name, o.legacy_agent_id
                FROM host_invites i JOIN lister_orgs o ON o.id = i.org_id
                WHERE i.token_hash = :h FOR UPDATE OF i
                """
            ),
            {"h": hash_token(token)},
        )
    ).mappings().first()
    if not inv:
        raise NotFoundException("This invite link is not valid. Ask us for a new one.")
    if inv["used_at"] and str(inv["used_by"]) != user_id:
        raise ConflictException(code="INVITE_USED", message="This invite link has already been used.")
    if not inv["used_at"] and inv["expires_at"] < datetime.now(timezone.utc):
        raise ConflictException(code="INVITE_EXPIRED", message="This invite link has expired. Ask us for a new one.")

    org_id = str(inv["org_id"])
    await db.execute(
        text(
            """
            INSERT INTO org_members (org_id, user_id, role) VALUES (CAST(:o AS uuid), CAST(:u AS uuid), 'owner')
            ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner'
            """
        ),
        {"o": org_id, "u": user_id},
    )
    await db.execute(text("UPDATE lister_orgs SET claimed_at = coalesce(claimed_at, now()) WHERE id = CAST(:o AS uuid)"), {"o": org_id})
    # A host created by staff has an agent whose login is a placeholder: give that agent to the real owner, so the
    # Rumia listing editor works for them too. Never take over an agent that belongs to someone real, and never give
    # a person a second agent.
    if inv["legacy_agent_id"]:
        await db.execute(
            text(
                """
                UPDATE agents a SET user_id = CAST(:u AS uuid)
                WHERE a.id = CAST(:a AS uuid)
                  AND (a.user_id IS NULL OR EXISTS (SELECT 1 FROM auth.users x WHERE x.id = a.user_id AND x.email LIKE :ph))
                  AND NOT EXISTS (SELECT 1 FROM agents b WHERE b.user_id = CAST(:u AS uuid))
                """
            ),
            {"u": user_id, "a": str(inv["legacy_agent_id"]), "ph": f"%{PLACEHOLDER_EMAIL_SUFFIX}"},
        )
    if not inv["used_at"]:
        await db.execute(
            text("UPDATE host_invites SET used_at = now(), used_by = CAST(:u AS uuid) WHERE id = :i"), {"u": user_id, "i": inv["id"]}
        )
    return {"org_id": org_id, "org_name": inv["name"]}


async def my_host_orgs(db: AsyncSession, user_id: str) -> List[Dict[str, Any]]:
    """The signed-in person's RumiaBnB host organisations, with their places."""
    orgs = (
        await db.execute(
            text(
                HOST_ORGS
                + """
                  AND o.status <> 'suspended'
                  AND o.id IN (SELECT org_id FROM org_members WHERE user_id = CAST(:u AS uuid))
                ORDER BY o.name
                """
            ),
            {"u": user_id},
        )
    ).mappings().all()
    ids = [str(o["id"]) for o in orgs]
    listings = await _listings(db, ids)
    return [{"id": str(o["id"]), "name": o["name"], "listings": listings.get(str(o["id"]), [])} for o in orgs]
