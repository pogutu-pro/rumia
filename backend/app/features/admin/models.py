import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TransferHistory(Base):
    __tablename__ = "transfer_history"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    listing_id: Mapped[str] = mapped_column(String, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    previous_owner_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"), nullable=False)
    new_owner_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"), nullable=False)
    transferred_by: Mapped[str] = mapped_column(String, nullable=False)
    transferred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
