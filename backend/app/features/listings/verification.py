"""
Auto-verification of Rumia listings against official DeKUT housing records.

Port of the TypeScript logic from web/src/lib/utils/dekut-verification.ts
"""
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class OfficialRecord:
    hostel_name: str
    zone: str
    contacts: List[str]
    payments: List[str]


@dataclass
class VerificationResult:
    verified: bool = False
    verified_source: Optional[str] = None
    verified_date: Optional[str] = None
    match_type: str = "none"  # phone | name | manual | none
    match_confidence: Optional[float] = None
    matched_hostel: Optional[str] = None
    matched_zone: Optional[str] = None
    flags: List[str] = field(default_factory=list)
    discrepancy_review_needed: bool = False
    shared_contact_detected: bool = False
    manual_review_needed: bool = False


# ── Phone normalization ──────────────────────────────────────────────────

_STRIP_RE = re.compile(r"[\s\-\(\)]+")


def _normalize_phone(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    cleaned = _STRIP_RE.sub("", raw.strip())
    if cleaned.startswith("+254"):
        cleaned = "0" + cleaned[4:]
    elif cleaned.startswith("254") and len(cleaned) >= 12:
        cleaned = "0" + cleaned[3:]
    if not cleaned.startswith("0") or len(cleaned) < 10:
        return None
    return cleaned[:10]


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.lower().strip())


# ── Data loading ─────────────────────────────────────────────────────────

_DATA_PATH = Path(__file__).parent / "dekut_official_records.json"
_RECORDS: Optional[List[OfficialRecord]] = None
_PHONE_INDEX: Optional[Dict[str, List[str]]] = None


def _parse_contacts(raw: str) -> List[str]:
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    normalized = []
    for p in parts:
        n = _normalize_phone(p)
        if n:
            normalized.append(n)
    return normalized


def _parse_payments(raw: str) -> List[str]:
    return [p.strip() for p in raw.split(";") if p.strip()]


def _load_records() -> List[OfficialRecord]:
    global _RECORDS
    if _RECORDS is not None:
        return _RECORDS
    with open(_DATA_PATH, "r") as f:
        raw = json.load(f)
    _RECORDS = [
        OfficialRecord(
            hostel_name=r["hostel_name"],
            zone=r.get("zone", ""),
            contacts=_parse_contacts(r.get("contacts", "")),
            payments=_parse_payments(r.get("payments", "")),
        )
        for r in raw
    ]
    return _RECORDS


def _build_phone_index(records: List[OfficialRecord]) -> Dict[str, List[str]]:
    global _PHONE_INDEX
    if _PHONE_INDEX is not None:
        return _PHONE_INDEX
    index: Dict[str, List[str]] = {}
    for record in records:
        for contact in record.contacts:
            bucket = index.setdefault(contact, [])
            bucket.append(record.hostel_name)
    _PHONE_INDEX = index
    return _PHONE_INDEX


# ── Similarity scoring (Jaccard + Levenshtein) ──────────────────────────

def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    rows = len(a) + 1
    cols = len(b) + 1
    prev = list(range(cols))
    for i in range(1, rows):
        curr = [i] + [0] * (cols - 1)
        for j in range(1, cols):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            curr[j] = min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[-1]


def _similarity_score(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    intersection = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    token_score = intersection / union if union else 0.0
    max_len = max(len(left), len(right))
    edit_score = 1 - _levenshtein(left, right) / max_len if max_len else 0.0
    return max(token_score, edit_score)


# ── Main verification function ──────────────────────────────────────────

def verify_listing(
    title: str,
    landlord_phone: Optional[str] = None,
    agent_phone: Optional[str] = None,
    agent_whatsapp: Optional[str] = None,
) -> VerificationResult:
    """
    Verify a listing against the official DeKUT housing directory.
    Matches by phone first (high confidence), then by name similarity.
    """
    records = _load_records()
    phone_index = _build_phone_index(records)

    listing_phones = [
        _normalize_phone(p) for p in [landlord_phone, agent_phone, agent_whatsapp] if p
    ]
    listing_phones = [p for p in listing_phones if p]

    flags: List[str] = []
    best_match = None

    # Phone match (takes priority)
    for phone in listing_phones:
        hostels_for_phone = phone_index.get(phone)
        if hostels_for_phone:
            record = next((r for r in records if phone in r.contacts), None)
            if record:
                if len(hostels_for_phone) > 1:
                    flags.append("shared_contact_detected")
                if not best_match or best_match["match_type"] != "phone":
                    best_match = {
                        "record": record,
                        "match_type": "phone",
                        "confidence": 1.0,
                    }

    # Name match if no phone match
    if not best_match:
        normalized_title = _normalize_name(title)
        for record in records:
            normalized_record = _normalize_name(record.hostel_name)
            sim = _similarity_score(normalized_record, normalized_title)
            if sim >= 0.85:
                if not best_match or sim > best_match["confidence"]:
                    best_match = {
                        "record": record,
                        "match_type": "name",
                        "confidence": sim,
                    }
            elif 0.5 <= sim < 0.85:
                flags.append("manual_name_match_review")

    if best_match:
        record = best_match["record"]
        verified = best_match["match_type"] == "phone"
        needs_manual = best_match["match_type"] == "name"
        return VerificationResult(
            verified=verified,
            verified_source="DeKUT Official Housing List" if verified else None,
            verified_date="2026-07-14" if verified else None,
            match_type=best_match["match_type"],
            match_confidence=best_match["confidence"],
            matched_hostel=record.hostel_name,
            matched_zone=record.zone or None,
            flags=flags,
            discrepancy_review_needed=needs_manual,
            shared_contact_detected="shared_contact_detected" in flags,
            manual_review_needed=needs_manual,
        )

    return VerificationResult(flags=flags)



# ── Helpers for admin tooling ────────────────────────────────────────────

@dataclass
class AgentMatch:
    verified: bool
    matched_hostels: List[str]
    shared_contact_detected: bool


def official_records() -> List[OfficialRecord]:
    """The bundled official DeKUT housing records."""
    return _load_records()


def match_agent_phone(phone: Optional[str]) -> Optional[AgentMatch]:
    """Does this phone appear in the official records? (None when the number is unusable.)"""
    normalized = _normalize_phone(phone)
    if not normalized:
        return None
    hostels = [r.hostel_name for r in _load_records() if normalized in r.contacts]
    return AgentMatch(verified=bool(hostels), matched_hostels=hostels, shared_contact_detected=len(hostels) > 1)


def verify_agent(phone: Optional[str], whatsapp: Optional[str]) -> AgentMatch:
    """Best verification result across an agent's phone and WhatsApp numbers."""
    first = match_agent_phone(phone)
    if first and first.verified:
        return first
    second = match_agent_phone(whatsapp)
    if second and second.verified:
        return second
    return AgentMatch(verified=False, matched_hostels=[], shared_contact_detected=False)


def raw_official_records() -> List[dict]:
    """The bundled records exactly as stored in the JSON file (for seeding the database)."""
    with open(_DATA_PATH, "r") as f:
        return json.load(f)
