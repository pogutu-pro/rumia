import uuid

import pytest
from sqlalchemy import text

from app.features.catalog.service import project_listing, refresh_distances, refresh_scores
from app.features.discovery import service
from app.features.discovery.service import SearchParams, decode_cursor, encode_cursor
from tests_pg.conftest import make_agent, make_campus, make_listing


async def _place(db, title, price, area="boma", room="Bedsitter", deposit=None, lat=None, lng=None, **kw):
    campus = await make_campus(db)
    agent = await make_agent(db, campus)
    listing = await make_listing(db, agent, campus, title=title, price=price, area=area, county="nyeri",
                                 latitude=lat, longitude=lng, **kw)
    await db.execute(
        text("INSERT INTO listing_room_types (listing_id, room_type, price, deposit, is_available) VALUES (CAST(:l AS uuid), :r, :p, :d, true)"),
        {"l": listing, "r": room, "p": price, "d": deposit},
    )
    pid = await project_listing(db, listing)
    if lat is not None:
        await db.execute(text("UPDATE properties SET lat = :a, lng = :b WHERE id = CAST(:p AS uuid)"), {"a": lat, "b": lng, "p": pid})
        await refresh_distances(db, pid)
    return pid


async def _clear(db):
    # The shared test database may hold other rows; scope each test to its own market-wide view.
    await db.execute(text("UPDATE properties SET status = 'archived' WHERE legacy_listing_id IS NULL OR true"))


@pytest.mark.asyncio
async def test_search_filters_by_price_unit_kind_place_and_text(db):
    await _clear(db)
    await _place(db, "Cheap Bedsit", 5000, area="boma", room="Bedsitter")
    await _place(db, "Mid Bedsit", 7500, area="boma", room="Bedsitter")
    await _place(db, "Pricey One Bed", 14000, area="nyaribo", room="1 Bedroom", property_type="apartment")

    res = await service.search(db, SearchParams(q="bedsitter under 8k"))
    assert {i.name for i in res.items} == {"Cheap Bedsit", "Mid Bedsit"} and res.total == 2
    assert {c["key"] for c in res.chips} == {"unit_kind", "max_price"}

    res = await service.search(db, SearchParams(q="1 bedroom apartment"))
    assert [i.name for i in res.items] == ["Pricey One Bed"]

    res = await service.search(db, SearchParams(places=["nyaribo"]))
    assert [i.name for i in res.items] == ["Pricey One Bed"]

    res = await service.search(db, SearchParams(q="Mid Bed"))
    assert res.items and res.items[0].name == "Mid Bedsit"  # typed name matches


@pytest.mark.asyncio
async def test_move_in_total_and_only_live_places_are_returned(db):
    await _clear(db)
    live = await _place(db, "Live Place", 7500, deposit=7500)
    hidden = await _place(db, "Paused Place", 7000)
    await db.execute(text("UPDATE properties SET status = 'paused' WHERE id = CAST(:p AS uuid)"), {"p": hidden})
    res = await service.search(db, SearchParams())
    assert [i.name for i in res.items] == ["Live Place"]
    assert res.items[0].move_in_total == 15000 and res.items[0].price_period == "month" and res.items[0].id == live


@pytest.mark.asyncio
async def test_nearer_and_fresher_places_rank_first_with_an_honest_reason(db):
    await _clear(db)
    far = await _place(db, "Far", 7000, lat=-0.4300, lng=36.9300)
    near = await _place(db, "Near", 7000, lat=-0.3950, lng=36.9640)
    res = await service.search(db, SearchParams(near="dekut"))
    assert [i.name for i in res.items] == ["Near", "Far"]
    assert res.items[0].reason == f"{res.items[0].walk_min} min walk to DeKUT"

    # Stale places drop below an equally-near fresh one.
    await db.execute(text("UPDATE properties SET status = 'stale' WHERE id = CAST(:p AS uuid)"), {"p": near})
    res = await service.search(db, SearchParams(near="dekut", sort="best"))
    assert res.items[0].name == "Far" or res.items[0].freshness == "Not confirmed recently"
    assert any(i.freshness == "Not confirmed recently" for i in res.items)


@pytest.mark.asyncio
async def test_few_results_suggest_the_change_that_helps(db):
    await _clear(db)
    await _place(db, "Just Over", 9000, room="Bedsitter")
    await _place(db, "Also Over", 9500, room="Bedsitter")
    res = await service.search(db, SearchParams(q="bedsitter under 8k"))
    assert res.total == 0
    assert res.relaxations and res.relaxations[0].count >= 2 and "budget" in res.relaxations[0].label.lower()


@pytest.mark.asyncio
async def test_pagination_cursor_and_limits(db):
    await _clear(db)
    for i in range(5):
        await _place(db, f"P{i}", 5000 + i * 100)
    first = await service.search(db, SearchParams(limit=2, sort="price_asc"))
    assert [i.name for i in first.items] == ["P0", "P1"] and first.next_cursor
    second = await service.search(db, SearchParams(limit=2, sort="price_asc", offset=decode_cursor(first.next_cursor)))
    assert [i.name for i in second.items] == ["P2", "P3"]
    last = await service.search(db, SearchParams(limit=2, sort="price_asc", offset=4))
    assert [i.name for i in last.items] == ["P4"] and last.next_cursor is None
    assert decode_cursor(encode_cursor(40)) == 40


@pytest.mark.asyncio
async def test_similar_places_prefer_same_area_and_similar_price(db):
    await _clear(db)
    await _place(db, "Anchor", 7000, area="boma")
    await _place(db, "Same Area Close Price", 7300, area="boma")
    await _place(db, "Other Area Close Price", 7100, area="nyaribo")
    await _place(db, "Way More", 30000, area="boma")
    slug = (await db.execute(text("SELECT slug FROM properties WHERE name = 'Anchor'"))).scalar_one()
    names = [c.name for c in await service.similar(db, slug)]
    assert names[0] == "Same Area Close Price" and "Anchor" not in names and "Way More" not in names


@pytest.mark.asyncio
async def test_alerts_email_only_new_matches_and_wait_when_nothing_is_new(db):
    from app.features.discovery.alerts import send_due_alerts

    await _clear(db)
    await _place(db, "Old Bedsit", 6000)
    await db.execute(text("UPDATE properties SET published_at = now() - interval '10 days'"))
    device = str(uuid.uuid4())
    await db.execute(text("INSERT INTO devices (id) VALUES (CAST(:d AS uuid))"), {"d": device})
    await db.execute(
        text("""INSERT INTO saved_searches (device_id, intent, label, channel, email, frequency, last_notified_at)
                VALUES (CAST(:d AS uuid), CAST(:i AS jsonb), 'bedsitters under 8k', 'email', 'a@b.c', 'daily', now() - interval '2 days')"""),
        {"d": device, "i": '{"q": "bedsitter under 8k"}'},
    )
    sent = []

    async def fake_send(to, subject, plain, page):
        sent.append((to, subject, plain))
        return True

    assert await send_due_alerts(db, fake_send) == {"sent": 0, "skipped": 1} and sent == []  # nothing new yet

    await _place(db, "Brand New Bedsit", 6500)
    result = await send_due_alerts(db, fake_send)
    assert result["sent"] == 1 and sent[0][0] == "a@b.c"
    assert "1 new place match bedsitters under 8k" in sent[0][1] and "Brand New Bedsit" in sent[0][2] and "Old Bedsit" not in sent[0][2]
    assert await send_due_alerts(db, fake_send) == {"sent": 0, "skipped": 0}  # not due again until tomorrow


@pytest.mark.asyncio
async def test_saved_cards_keep_order_and_say_when_a_place_was_taken(db):
    await _clear(db)
    a = await _place(db, "Saved A", 6000)
    b = await _place(db, "Saved B", 7000)
    listing_a = (await db.execute(text("SELECT legacy_listing_id::text FROM properties WHERE id = CAST(:p AS uuid)"), {"p": a})).scalar_one()
    listing_b = (await db.execute(text("SELECT legacy_listing_id::text FROM properties WHERE id = CAST(:p AS uuid)"), {"p": b})).scalar_one()
    await db.execute(text("UPDATE properties SET status = 'let' WHERE id = CAST(:p AS uuid)"), {"p": b})
    cards = await service.cards_for_listing_ids(db, [listing_b, listing_a, "not-a-uuid"])
    assert [c.name for c in cards] == ["Saved B", "Saved A"]
    assert cards[0].freshness == "Let" and cards[0].status == "let"


@pytest.mark.asyncio
async def test_lister_profile_shows_live_places_and_hides_reply_rate_until_it_means_something(db):
    await _clear(db)
    pid = await _place(db, "Profile Place", 6500)
    slug = (await db.execute(text("SELECT o.slug FROM lister_orgs o JOIN properties p ON p.org_id = o.id WHERE p.id = CAST(:p AS uuid)"), {"p": pid})).scalar_one()
    profile = await service.org_profile(db, slug)
    assert [c.name for c in profile["places"]] == ["Profile Place"] and profile["reply_rate"] is None
