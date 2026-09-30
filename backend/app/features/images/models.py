import uuid
from datetime import datetime
from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ImageUpload(Base):
    __tablename__ = "image_uploads"

    id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    format: Mapped[str] = mapped_column(String, default="webp", nullable=False)
    thumbnail_key: Mapped[str] = mapped_column(String, nullable=False)
    small_key: Mapped[str] = mapped_column(String, nullable=False)
    medium_key: Mapped[str] = mapped_column(String, nullable=False)
    large_key: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
