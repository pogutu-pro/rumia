from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

StayStatus = Literal["requested", "confirmed", "declined", "cancelled", "completed", "no_show", "disputed"]


class Attribution(BaseModel):
    """Where the guest came from. Captured on the first page they landed on and sent with every contact."""

    utm_source: Optional[str] = Field(None, max_length=100)
    utm_medium: Optional[str] = Field(None, max_length=100)
    utm_campaign: Optional[str] = Field(None, max_length=100)
    utm_content: Optional[str] = Field(None, max_length=100)
    landing_path: Optional[str] = Field(None, max_length=300)
    heard_from: Optional[str] = Field(None, max_length=60, description="The guest's answer to 'How did you hear about us?'")


class QuoteRead(BaseModel):
    nights: int
    rate_basis: Literal["night", "week", "month"]
    room_total: float
    cleaning_fee: Optional[float] = None
    total: float


class StayRequestCreate(BaseModel):
    listing: str = Field(..., description="Listing id or slug")
    check_in: date
    check_out: date
    guests: int = Field(..., ge=1, le=50)
    guest_name: str = Field(..., min_length=2, max_length=80)
    guest_phone: str = Field(..., min_length=7, max_length=20)
    guest_email: Optional[str] = Field(None, max_length=120)
    note: Optional[str] = Field(None, max_length=1000)
    session_id: Optional[str] = Field(None, max_length=64)
    attribution: Attribution = Attribution()


class StayRequestCreated(BaseModel):
    ref_code: str
    token: str = Field(..., description="Secret for the guest's status page (/r/{token}). Shown once.")
    status: StayStatus
    listing_title: str
    quote: QuoteRead


class GuestStayView(BaseModel):
    ref_code: Optional[str]
    status: StayStatus
    listing_title: str
    listing_slug: Optional[str]
    check_in: date
    check_out: date
    nights: int
    guests: int
    quoted_total: float
    agreed_total: Optional[float]
    host_note: Optional[str]
    guest_report: Optional[str]
    can_cancel: bool
    can_report: bool


class GuestReport(BaseModel):
    stayed: bool


class ConciergeContactCreate(BaseModel):
    listing: Optional[str] = Field(None, description="Listing id or slug, when the guest asks about one place")
    session_id: Optional[str] = Field(None, max_length=64)
    attribution: Attribution = Attribution()


class ConciergeContactResult(BaseModel):
    ref_code: str
    whatsapp_url: str
    message: str


class StayRow(BaseModel):
    """A stay request as hosts and staff see it."""

    id: str
    ref_code: Optional[str]
    status: StayStatus
    origin: str
    listing_id: Optional[str]
    listing_title: str
    listing_slug: Optional[str]
    org_id: Optional[str]
    guest_name: str
    guest_phone: str
    guest_email: Optional[str]
    guests: int
    check_in: date
    check_out: date
    nights: int
    rate_basis: str
    quoted_total: float
    agreed_total: Optional[float]
    cleaning_fee: Optional[float]
    guest_note: Optional[str]
    host_note: Optional[str]
    guest_report: Optional[str]
    host_report: Optional[str]
    source: Optional[str] = Field(None, description="utm_source, or what the guest said when asked")
    utm_campaign: Optional[str]
    fee_amount: Optional[float]
    fee_status: Optional[str]
    created_at: datetime


class StayEvent(BaseModel):
    at: datetime
    actor: str
    action: str
    from_status: Optional[str]
    to_status: Optional[str]
    note: Optional[str]


class StayDetail(StayRow):
    events: List[StayEvent] = []


class HostConfirm(BaseModel):
    agreed_total: Optional[float] = Field(None, ge=0, description="Room charges agreed with the guest, if different from the quote")
    host_note: Optional[str] = Field(None, max_length=500)


class HostDecline(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


class HostReport(BaseModel):
    stayed: bool


class OpsStayCreate(BaseModel):
    """A booking the concierge arranged on WhatsApp, recorded on the guest's behalf."""

    listing: str
    check_in: date
    check_out: date
    guests: int = Field(..., ge=1, le=50)
    guest_name: str = Field(..., min_length=2, max_length=80)
    guest_phone: str = Field(..., min_length=7, max_length=20)
    note: Optional[str] = Field(None, max_length=1000)
    ref_code: Optional[str] = Field(None, max_length=8, description="The concierge chat's reference code, to keep its attribution")


class OpsStatusChange(BaseModel):
    to_status: StayStatus
    note: str = Field(..., min_length=3, max_length=500, description="Why (kept in the history)")
    agreed_total: Optional[float] = Field(None, ge=0)


class AgreementCreate(BaseModel):
    org_id: str
    fee_percent: float = Field(..., ge=0, le=100)
    fee_min: float = Field(0, ge=0)
    fee_night_cap: Optional[int] = Field(30, gt=0)
    effective_from: Optional[date] = None
    note: Optional[str] = Field(None, max_length=500)


class AgreementRead(BaseModel):
    id: str
    org_id: str
    org_name: Optional[str] = None
    fee_percent: float
    fee_min: float
    fee_night_cap: Optional[int]
    effective_from: date
    effective_to: Optional[date]
    note: Optional[str]
    created_at: datetime


class ContactRow(BaseModel):
    ref_code: str
    channel: str
    handled_by: str
    listing_title: Optional[str]
    source: Optional[str]
    utm_campaign: Optional[str]
    landing_path: Optional[str]
    created_at: datetime
    has_request: bool


class SourceCount(BaseModel):
    source: str
    contacts: int
    requests: int
    completed: int


class HostSummary(BaseModel):
    """What RumiaBnB brought a host over a period."""

    since: date
    views: int
    contacts: int
    requests: int
    confirmed: int
    completed: int
    room_value_completed: float
    fees_pending: float
    fees_paid: float
    by_source: List[SourceCount]


class HostListing(BaseModel):
    id: str
    title: str
    slug: Optional[str]
    is_active: bool


class HostOrg(BaseModel):
    id: str
    name: str
    listings: List[HostListing]


class HostAdminRow(HostOrg):
    slug: str
    claimed_at: Optional[datetime]
    has_login: bool = Field(..., description="Someone other than a staff-made placeholder can sign in for this host")
    open_requests: int
    agreement: Optional[dict] = None


class InviteRead(BaseModel):
    url: str
    expires_at: datetime


class ClaimBody(BaseModel):
    token: str = Field(..., min_length=10, max_length=100)


class ClaimResult(BaseModel):
    org_id: str
    org_name: str
