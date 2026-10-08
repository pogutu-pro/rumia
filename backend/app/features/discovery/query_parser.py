"""Turn what someone typed ("bedsitter near dekut under 8k with wifi") into filters.

Pure and data-driven: place and landmark names come from the database, not from code, so a new town needs
no changes here. Whatever is not understood stays as free text for name matching.
"""
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

UNIT_WORDS = [
    (r"\bbed ?sit(?:ter)?s?\b", "bedsitter"),
    (r"\bstudios?\b", "studio"),
    (r"\b(?:1|one)[ -]?(?:bed(?:room)?s?|br)\b", "one_bed"),
    (r"\b(?:2|two)[ -]?(?:bed(?:room)?s?|br)\b", "two_bed"),
    (r"\b(?:3|three|4|four)[ -]?(?:bed(?:room)?s?|br)\b", "three_bed_plus"),
    (r"\bsingle(?: room)?s?\b", "single_room"),
    (r"\bdouble(?: room)?s?\b", "double_room"),
    (r"\bshar(?:ed|ing)\b", "shared_room"),
]
KIND_WORDS = [(r"\bhostels?\b", "hostel"), (r"\bapartments?\b|\bflats?\b", "apartment"), (r"\bhouses?\b|\bhomes?\b", "house")]
AMENITY_WORDS = {"wifi": "wifi", "wi-fi": "wifi", "parking": "parking", "water": "water", "security": "security", "furnished": "furnished"}
NIGHTLY = re.compile(r"\b(?:per night|nightly|airbnb|short stay|weekend|a few nights|bnb)\b")

_PRICE = re.compile(
    r"(?P<cmp>under|below|less than|max(?:imum)?|up to|<=?|around|about|over|above|from|min(?:imum)?|>=?)?\s*"
    r"(?:ksh?s?\.?|kes)?\s*(?P<num>\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?P<k>k|000)?\b",
    re.I,
)


@dataclass
class ParsedQuery:
    text: str = ""
    max_price: Optional[float] = None
    min_price: Optional[float] = None
    unit_kind: List[str] = field(default_factory=list)
    kind: Optional[str] = None
    amenities: List[str] = field(default_factory=list)
    places: List[str] = field(default_factory=list)  # place slugs
    landmark: Optional[str] = None  # landmark slug
    mode: Optional[str] = None
    chips: List[Dict[str, str]] = field(default_factory=list)


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def parse_query(q: str, places: Sequence[dict], landmarks: Sequence[dict]) -> ParsedQuery:
    """`places`/`landmarks` are dicts with slug, name and aliases."""
    out = ParsedQuery()
    rest = f" {q.lower()} "

    if NIGHTLY.search(rest):
        out.mode = "nightly"
        out.chips.append({"key": "mode", "label": "Per night"})
        rest = NIGHTLY.sub(" ", rest)

    for pattern, unit in UNIT_WORDS:
        if re.search(pattern, rest):
            out.unit_kind.append(unit)
            out.chips.append({"key": "unit_kind", "value": unit, "label": unit.replace("_", " ").replace("one bed", "1 bedroom").replace("two bed", "2 bedrooms").replace("three bed plus", "3+ bedrooms")})
            rest = re.sub(pattern, " ", rest)
    for pattern, kind in KIND_WORDS:
        if re.search(pattern, rest) and not out.kind:
            out.kind = kind
            out.chips.append({"key": "kind", "value": kind, "label": kind.capitalize()})
            rest = re.sub(pattern, " ", rest)
    for word, amenity in AMENITY_WORDS.items():
        if re.search(rf"\b{re.escape(word)}\b", rest) and amenity not in out.amenities:
            out.amenities.append(amenity)
            out.chips.append({"key": "amenity", "value": amenity, "label": amenity.capitalize() if amenity != "wifi" else "Wi-Fi"})
            rest = re.sub(rf"\b{re.escape(word)}\b", " ", rest)
    rest = re.sub(r"\bwith\b|\band\b", " ", rest)

    # Landmarks ("near dekut") and places ("in kamakwa"): longest names first so "near gate a" beats "gate".
    def names(rows):
        pairs = []
        for r in rows:
            for n in [r["name"], *(r.get("aliases") or []), r["slug"].replace("-", " ")]:
                if _norm(n):
                    pairs.append((_norm(n), r))
        return sorted(pairs, key=lambda p: -len(p[0]))

    flat = f" {_norm(rest)} "
    for n, r in names(landmarks):
        if f" {n} " in flat and not out.landmark:
            out.landmark = r["slug"]
            out.chips.append({"key": "landmark", "value": r["slug"], "label": f"Near {r['name']}"})
            flat = flat.replace(f" {n} ", " ", 1)
    for n, r in names(places):
        if f" {n} " in flat and r["slug"] not in out.places:
            out.places.append(r["slug"])
            out.chips.append({"key": "place", "value": r["slug"], "label": r["name"]})
            flat = flat.replace(f" {n} ", " ", 1)
    rest = flat
    rest = re.sub(r"\b(?:near|in|at|around|by|close to|next to)\b", " ", rest)

    # Prices last, so the digits in "1 bedroom" are already consumed.
    for m in list(_PRICE.finditer(rest)):
        num = float(m.group("num").replace(",", ""))
        if m.group("k") and m.group("k").lower() == "k":
            num *= 1000
        elif m.group("k") == "000":
            num *= 1000
        if num < 500:  # a bare small number is not a rent
            continue
        cmp_ = (m.group("cmp") or "").lower()
        if cmp_ in ("over", "above", "from", "min", "minimum", ">", ">="):
            out.min_price = num
            out.chips.append({"key": "min_price", "value": str(int(num)), "label": f"From KSh {int(num):,}"})
        else:
            out.max_price = num
            out.chips.append({"key": "max_price", "value": str(int(num)), "label": f"Under KSh {int(num):,}"})
        rest = rest.replace(m.group(0), " ")
    out.text = re.sub(r"\s+", " ", rest).strip()
    return out
