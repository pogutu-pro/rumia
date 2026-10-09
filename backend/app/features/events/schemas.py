from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

# Only events a named feature or decision uses (see docs/restructure/08-intelligence.md §3).
EventName = Literal[
    "session_started",
    "intent_set",
    "search_performed",
    "results_impression",
    "property_opened",
    "media_engaged",
    "property_dwell",
    "save_toggled",
    "share_clicked",
    "contact_followup_answered",
    "directions_opened",
    "not_interested",
    "alert_created",
    "alert_opened",
    "outcome_reported",
]
Surface = Literal["home", "explore", "property", "saved", "watch", "share_landing", "place", "check", "other"]
Referrer = Literal["whatsapp", "instagram", "tiktok", "facebook", "google", "direct", "internal", "other"]

MAX_PROPS_BYTES = 2048


class EventIn(BaseModel):
    event_id: Optional[str] = Field(None, description="Client-generated UUID, used to ignore duplicates")
    name: EventName
    occurred_at: Optional[datetime] = None
    surface: Optional[Surface] = None
    referrer_kind: Optional[Referrer] = None
    market: Optional[str] = Field(None, max_length=40)
    listing_id: Optional[str] = None
    props: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("props")
    @classmethod
    def _small(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        import json

        if len(json.dumps(v, default=str)) > MAX_PROPS_BYTES:
            raise ValueError("props too large")
        return v


class EventBatch(BaseModel):
    session_id: Optional[str] = Field(None, max_length=64)
    events: List[EventIn] = Field(..., min_length=1, max_length=50)


class EventBatchResult(BaseModel):
    accepted: int
