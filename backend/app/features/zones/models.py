from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CampusZone(Base):
    __tablename__ = "campus_zones"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid())
    campus_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("campuses.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, nullable=False)
    distance_category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    full_search_price: Mapped[int] = mapped_column(Integer, nullable=False, server_default="500")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
