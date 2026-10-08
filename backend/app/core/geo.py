"""Distances between points without PostGIS (plain latitude/longitude maths)."""
import math

EARTH_RADIUS_M = 6_371_000
WALK_SPEED_M_PER_MIN = 80.0  # ~4.8 km/h
ROUTE_DETOUR_FACTOR = 1.3  # streets are longer than the straight line


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def walk_minutes(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Estimated walking time, rounded up to whole minutes (minimum 1)."""
    metres = haversine_m(lat1, lng1, lat2, lng2) * ROUTE_DETOUR_FACTOR
    return max(1, math.ceil(metres / WALK_SPEED_M_PER_MIN))
