from app.core.geo import haversine_m, walk_minutes
from app.core.slug import listing_path, url_segment

DEKUT = (-0.3946, 36.9635)
NYERI_CBD = (-0.4197, 36.9510)


def test_distance_between_known_points_is_plausible():
    # DeKUT to Nyeri town is a few kilometres.
    km = haversine_m(*DEKUT, *NYERI_CBD) / 1000
    assert 2.5 < km < 4.0
    assert haversine_m(*DEKUT, *DEKUT) == 0


def test_walk_minutes_has_a_floor_and_grows_with_distance():
    assert walk_minutes(*DEKUT, *DEKUT) == 1
    assert walk_minutes(*DEKUT, *NYERI_CBD) > 30


def test_listing_path_matches_the_web_helper():
    assert url_segment("Near Gate A") == "near-gate-a"
    assert url_segment("King'ong'o") == "king-ong-o"
    assert listing_path("nyeri", "Near Gate A", "baraka-1a2b") == "/hostels/nyeri/near-gate-a/baraka-1a2b"
    assert listing_path(None, None, "x") == "/hostels/nyeri/dekut/x"
