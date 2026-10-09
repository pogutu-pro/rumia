import io
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from PIL import Image
from sqlalchemy import text

from app.core.config import settings
from app.core.tasks import jobs
from app.features.catalog.service import project_listing
from app.features.media import processing
from app.features.ops import service as ops
from tests_pg.conftest import make_agent, make_campus, make_listing, make_user


def _png(seed: int) -> bytes:
    img = Image.new("RGB", (160, 120))
    px = img.load()
    for x in range(160):
        for y in range(120):
            px[x, y] = ((x * 3 + seed * 40) % 256, (y * 5) % 256, (x * y + seed) % 256)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture
def photo_server(monkeypatch):
    files = {"/a.png": _png(1), "/b.png": _png(1), "/c.png": _png(2)}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = files.get(self.path)
            self.send_response(200 if body else 404)
            self.end_headers()
            if body:
                self.wfile.write(body)

        def log_message(self, *a):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    monkeypatch.setattr(settings, "R2_PUBLIC_URL", base)
    yield base
    server.shutdown()


async def _listing_with_photo(db, url):
    campus = await make_campus(db)
    agent = await make_agent(db, campus, user_id=await make_user(db))
    listing = await make_listing(db, agent, campus)
    await db.execute(text("INSERT INTO listing_images (listing_id, r2_url, display_order) VALUES (CAST(:l AS uuid), :u, 0)"), {"l": listing, "u": url})
    return listing, await project_listing(db, listing)


async def _hash(db, listing):
    return (await db.execute(text(
        "SELECT m.content_hash FROM media_assets m JOIN listing_images i ON i.id = m.legacy_image_id WHERE i.listing_id = CAST(:l AS uuid)"), {"l": listing})).scalar_one()


async def _drain(db):
    rows = (await db.execute(text("SELECT payload->>'asset_id' FROM jobs WHERE kind = 'hash_legacy_media' AND status = 'queued'"))).all()
    return [r[0] for r in rows]


@pytest.mark.asyncio
async def test_saving_a_listing_queues_a_fingerprint_job_for_its_photos(db, photo_server):
    listing, _ = await _listing_with_photo(db, f"{photo_server}/a.png")
    assert await _hash(db, listing) is None
    queued = await _drain(db)
    assert len(queued) >= 1
    # Saving again does not pile up duplicates.
    await project_listing(db, listing)
    assert len(await _drain(db)) == len(queued)


@pytest.mark.asyncio
async def test_the_job_fingerprints_photos_so_duplicates_are_flagged_for_review(db, photo_server, monkeypatch):
    # The job opens its own sessions; point it at this test's session so the rolled-back data is visible.
    class Shared:
        def __call__(self):
            return self

        async def __aenter__(self):
            return db

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(processing, "async_session_factory", Shared())
    db.commit = _noop  # the test transaction is rolled back at the end

    l1, p1 = await _listing_with_photo(db, f"{photo_server}/a.png")
    l2, p2 = await _listing_with_photo(db, f"{photo_server}/b.png")  # same picture, another lister
    l3, _ = await _listing_with_photo(db, f"{photo_server}/c.png")  # a different picture
    for asset in await _drain(db):
        await processing.hash_legacy_media({"asset_id": asset})

    h1, h2, h3 = await _hash(db, l1), await _hash(db, l2), await _hash(db, l3)
    assert h1 and h1 == h2 and h3 and h3 != h1

    for pid in (p1, p2):
        await db.execute(text("UPDATE properties SET status = 'in_review' WHERE id = CAST(:p AS uuid)"), {"p": pid})
    access = type("A", (), {"staff_markets": None})()
    rows = await ops.review_queue(db, access)
    dup = {str(r["id"]): r["duplicate_photos"] for r in rows if str(r["id"]) in (p1, p2)}
    assert dup == {p1: 1, p2: 1}


async def _noop():
    return None


@pytest.mark.asyncio
async def test_a_photo_url_outside_our_storage_is_never_fetched(db, photo_server, monkeypatch):
    class Shared:
        def __call__(self):
            return self

        async def __aenter__(self):
            return db

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(processing, "async_session_factory", Shared())
    db.commit = _noop
    fetched = []
    monkeypatch.setattr(processing.httpx, "AsyncClient", lambda *a, **k: fetched.append(1) or (_ for _ in ()).throw(AssertionError("fetched")))
    listing, _ = await _listing_with_photo(db, "http://169.254.169.254/latest/meta-data/photo.png")
    await db.execute(text("UPDATE media_assets SET status = 'ready'"))
    for asset in await _drain(db):
        await processing.hash_legacy_media({"asset_id": asset})
    assert fetched == []
    assert await _hash(db, listing) is None
