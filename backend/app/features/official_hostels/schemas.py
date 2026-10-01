from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class OfficialHostelRead(BaseModel):
    id: str
    hostel_name: str
    zone: Optional[str] = None
    contacts: Optional[str] = None
    payments: Optional[str] = None
    source: Optional[str] = None
    verified_date: Optional[date] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class OfficialHostelWrite(BaseModel):
    hostel_name: str = Field(..., min_length=1, max_length=300)
    zone: Optional[str] = Field(None, max_length=200)
    contacts: Optional[str] = Field(None, max_length=2000)
    payments: Optional[str] = Field(None, max_length=2000)
    source: Optional[str] = Field(None, max_length=200)
    verified_date: Optional[date] = None


class AgentListingHostel(BaseModel):
    """A platform listing as compared against the official records."""

    id: str
    title: str
    location: str
    price: Optional[float] = None
    is_active: bool
    verified: bool
    is_full: bool = False
    created_at: datetime
    landlord_phone: str = ""
    mpesa_details: str = ""
    specific_location: str = ""
    county: str = "nyeri"
    area: str = "dekut"
    slug: Optional[str] = None
    agent_name: str = "Agent"
    agent_phone: str = ""
    agent_whatsapp: str = ""


class OfficialHostelsOverview(BaseModel):
    official_hostels: List[OfficialHostelRead]
    listings: List[AgentListingHostel]
