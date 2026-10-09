from typing import Literal, Optional

from pydantic import BaseModel, Field

Channel = Literal["whatsapp", "call"]


class InquiryCreate(BaseModel):
    listing_id: Optional[str] = Field(None, description="Legacy listing id")
    property_id: Optional[str] = Field(None, description="Property id; resolved to its listing")
    channel: Channel = "whatsapp"
    session_id: Optional[str] = Field(None, max_length=64)
    source: Optional[str] = Field(None, max_length=40, description="Where the contact was made, e.g. 'property', 'card'")


class InquiryResult(BaseModel):
    ref_code: str
    channel: Channel
    contact_name: str
    whatsapp_url: Optional[str] = None
    tel_url: Optional[str] = None
    message: str
    listing_is_full: bool = False


class InquiryFollowup(BaseModel):
    replied: Literal["yes", "no", "not_yet"]


class InquiryOutcome(BaseModel):
    outcome: Literal["moved_in", "not_suitable", "no_reply"]
