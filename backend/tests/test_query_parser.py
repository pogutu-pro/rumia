from app.features.discovery.query_parser import parse_query

PLACES = [
    {"slug": "kamakwa", "name": "Kamakwa", "aliases": []},
    {"slug": "near-gate-a", "name": "Near Gate A", "aliases": ["gate a"]},
    {"slug": "boma", "name": "Boma", "aliases": []},
]
LANDMARKS = [
    {"slug": "dekut", "name": "DeKUT", "aliases": ["dedan kimathi", "dkut"]},
    {"slug": "nyeri-cbd", "name": "Nyeri town centre", "aliases": ["town", "cbd"]},
]


def chips(q):
    p = parse_query(q, PLACES, LANDMARKS)
    return p, {(c["key"], c.get("value")) for c in p.chips}


def test_the_example_from_the_plan():
    p, c = chips("bedsitter near dekut under 8k with wifi")
    assert p.unit_kind == ["bedsitter"] and p.landmark == "dekut"
    assert p.max_price == 8000 and p.amenities == ["wifi"] and p.text == ""


def test_bedrooms_are_not_mistaken_for_prices():
    p, _ = chips("2 bedroom apartment in kamakwa under 30,000")
    assert p.unit_kind == ["two_bed"] and p.kind == "apartment"
    assert p.places == ["kamakwa"] and p.max_price == 30000


def test_budget_words_and_minimums():
    assert chips("cheap rooms below 6000")[0].max_price == 6000
    assert chips("1 bedroom from 12k")[0].min_price == 12000
    assert chips("studio KSh 15000")[0].max_price == 15000


def test_places_aliases_and_nightly_mode():
    p, _ = chips("near gate a hostel")
    assert p.places == ["near-gate-a"] and p.kind == "hostel"
    p, _ = chips("airbnb in town this weekend")
    assert p.mode == "nightly" and p.landmark == "nyeri-cbd"


def test_unknown_words_stay_as_text_for_name_matching():
    p, _ = chips("baraka")
    assert p.text == "baraka" and not p.chips
    p, _ = chips("baraka under 9k")
    assert p.text == "baraka" and p.max_price == 9000


def test_small_bare_numbers_are_not_rents():
    p, _ = chips("room 3")
    assert p.max_price is None
