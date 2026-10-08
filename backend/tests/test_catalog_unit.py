import io
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image

from app.core.config import settings
from app.core.errors import BadRequestException
from app.core.permissions import AccessContext
from app.features.catalog import lifecycle
from app.features.catalog.service import build_facts, compute_quality, days_ago_text, tier_for
from app.features.media.processing import InvalidImage, hamming, process_image_bytes

NOW = datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc)


def _jpeg(size=(1000, 800), color=(120, 90, 60)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG")
    return buf.getvalue()


# ── facts ────────────────────────────────────────────────────────────────────────────────────────
def test_days_ago_wording():
    assert days_ago_text(NOW, NOW) == "today"
    assert days_ago_text(NOW - timedelta(days=1), NOW) == "yesterday"
    assert days_ago_text(NOW - timedelta(days=5), NOW) == "5 days ago"
    assert days_ago_text(NOW - timedelta(days=21), NOW) == "3 weeks ago"
    assert days_ago_text(NOW - timedelta(days=120), NOW) == "4 months ago"


def test_facts_only_state_what_evidence_supports():
    assert build_facts([], NOW, "live") == []  # no evidence: no claim
    confirm = {"kind": "availability_confirm", "status": "valid", "observed_at": datetime.now(timezone.utc), "source": "lister"}
    visit = {"kind": "site_visit", "status": "valid", "observed_at": datetime(2026, 9, 12, tzinfo=timezone.utc), "source": None}
    registry = {"kind": "registry_match", "status": "valid", "observed_at": datetime(2026, 8, 1, tzinfo=timezone.utc), "source": "DeKUT"}
    texts = [f.text for f in build_facts([confirm, visit, registry], NOW, "live")]
    assert texts[0].startswith("Available, confirmed by the owner")
    assert "Visited by Rumia on 12 Sep 2026" in texts
    assert "In DeKUT register" in texts
    # A source that already says "register" is not repeated.
    registry2 = dict(registry, source="DeKUT register")
    assert "In DeKUT register" in [f.text for f in build_facts([registry2], NOW, "live")]


def test_stale_places_say_so_and_never_claim_availability():
    confirm = {"kind": "availability_confirm", "status": "valid", "observed_at": NOW - timedelta(days=20), "source": "lister"}
    texts = [f.text for f in build_facts([confirm], NOW, "stale")]
    assert len(texts) == 1 and texts[0].startswith("Not confirmed recently") and "Available" not in texts[0]
    assert build_facts([], NOW, "stale")[0].text.startswith("Not confirmed recently")


# ── scoring ──────────────────────────────────────────────────────────────────────────────────────
def test_quality_rewards_complete_recent_evidenced_listings():
    best = compute_quality(photos=10, has_video=True, has_registry=True, has_visit=True, confirmed_days=0,
                           description_len=200, has_location=True, has_deposit_info=True)
    bare = compute_quality(photos=0, has_video=False, has_registry=False, has_visit=False, confirmed_days=None,
                           description_len=0, has_location=False, has_deposit_info=False)
    stale = compute_quality(photos=10, has_video=True, has_registry=True, has_visit=True, confirmed_days=45,
                            description_len=200, has_location=True, has_deposit_info=True)
    assert best == 100 and bare == 0 and 0 < stale < best


def test_tier_needs_enough_peers_and_uses_price_position():
    assert tier_for(50000, [1000] * 5) == "standard"  # too few peers to call anything premium
    peers = [float(x) for x in range(1000, 21000, 1000)]  # 20 peers
    assert tier_for(20000, peers) == "premium"
    assert tier_for(2000, peers) == "value"
    assert tier_for(10000, peers) == "standard"


# ── lifecycle ────────────────────────────────────────────────────────────────────────────────────
def test_transition_table_is_closed_and_sensible():
    assert "live" in lifecycle.TRANSITIONS["stale"] and "paused" in lifecycle.TRANSITIONS["stale"]
    assert lifecycle.TRANSITIONS["archived"] == ()
    assert "live" not in lifecycle.TRANSITIONS["removed"]  # removal is not undone by a lister
    for targets in lifecycle.TRANSITIONS.values():
        assert set(targets) <= set(lifecycle.TRANSITIONS)


def test_action_tokens_round_trip_and_reject_tampering(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_JWT_SECRET", "x" * 40)
    token = lifecycle.make_action_token("11111111-1111-1111-1111-111111111111", "confirm")
    assert lifecycle.read_action_token(token) == ("11111111-1111-1111-1111-111111111111", "confirm")
    with pytest.raises(BadRequestException):
        lifecycle.read_action_token(token[:-3] + "abc")
    expired = lifecycle.make_action_token("p", "pause", ttl_days=-1)
    with pytest.raises(BadRequestException):
        lifecycle.read_action_token(expired)
    with pytest.raises(ValueError):
        lifecycle.make_action_token("p", "delete")


# ── permissions ──────────────────────────────────────────────────────────────────────────────────
def test_permissions_respect_market_and_org_scope():
    lead_nyeri = AccessContext("u1", staff={("market_lead", "m-nyeri")})
    assert lead_nyeri.can("property.review", market_id="m-nyeri")
    assert not lead_nyeri.can("property.review", market_id="m-other")
    assert not lead_nyeri.can("staff.manage", market_id="m-nyeri")

    admin = AccessContext("u2", staff={("admin", None)})
    assert admin.can("staff.manage") and admin.can("property.review", market_id="anything")

    owner = AccessContext("u3", orgs={"org-1": "owner"})
    agent = AccessContext("u4", orgs={"org-1": "agent"})
    assert owner.can("property.pause", org_id="org-1") and not owner.can("property.pause", org_id="org-2")
    assert agent.can("property.confirm", org_id="org-1") and not agent.can("property.pause", org_id="org-1")
    assert not AccessContext("seeker").can("property.create")


# ── image processing ─────────────────────────────────────────────────────────────────────────────
def test_image_processing_makes_variants_blur_and_hash():
    out = process_image_bytes(_jpeg((2000, 1500)))
    assert set(out.variants) == {"thumb", "card", "gallery", "large"}
    assert out.sizes["thumb"] == (400, 300) and out.sizes["card"] == (800, 600)
    assert out.sizes["gallery"][0] == 1200 and out.sizes["large"][0] == 1600
    assert out.blur_data_url.startswith("data:image/webp;base64,") and len(out.blur_data_url) < 2000
    assert len(out.content_hash) == 16
    assert all(Image.open(io.BytesIO(b)).format == "WEBP" for b in out.variants.values())


def test_processing_never_upscales_and_strips_metadata():
    out = process_image_bytes(_jpeg((900, 700)))
    assert out.sizes["gallery"] == (900, 700) and out.sizes["large"] == (900, 700)
    assert not Image.open(io.BytesIO(out.variants["gallery"])).info.get("exif")


def test_rejects_bad_files():
    with pytest.raises(InvalidImage):
        process_image_bytes(b"not an image")
    with pytest.raises(InvalidImage):
        process_image_bytes(_jpeg((300, 200)))
    with pytest.raises(InvalidImage):
        process_image_bytes(b"0" * (16 * 1024 * 1024))


def test_perceptual_hash_matches_resized_copies_but_not_different_pictures():
    from PIL import ImageDraw

    def picture(seed_boxes):
        img = Image.new("RGB", (1200, 900), (200, 200, 200))
        d = ImageDraw.Draw(img)
        for box in seed_boxes:
            d.rectangle(box, fill=(30, 60, 160))
        buf = io.BytesIO(); img.save(buf, format="JPEG"); return buf.getvalue()

    a = process_image_bytes(picture([(100, 100, 500, 400), (700, 500, 1100, 850)]))
    small = Image.open(io.BytesIO(picture([(100, 100, 500, 400), (700, 500, 1100, 850)]))).resize((800, 600))
    buf = io.BytesIO(); small.save(buf, format="JPEG")
    b = process_image_bytes(buf.getvalue())
    c = process_image_bytes(picture([(600, 50, 1150, 300), (50, 600, 400, 880)]))
    assert hamming(a.content_hash, b.content_hash) <= 4
    assert hamming(a.content_hash, c.content_hash) > 8
