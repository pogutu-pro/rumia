import uuid
from datetime import date, datetime
from typing import Optional
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    listing_id: Mapped[str] = mapped_column(String, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    stay_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    stay_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    school_verified_at_review_time: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String, default="published", nullable=False)
    author_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    author_avatar_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Category ratings (1..5 or None)
    rating_cleanliness: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    rating_security: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    rating_water: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    rating_wifi: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    rating_facilities: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    rating_location: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    rating_management: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    rating_value: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    likes: Mapped[list["ReviewLike"]] = relationship("ReviewLike", back_populates="review", cascade="all, delete-orphan", lazy="selectin")
    replies: Mapped[list["ReviewReply"]] = relationship("ReviewReply", back_populates="review", cascade="all, delete-orphan", lazy="selectin")


class ReviewLike(Base):
    __tablename__ = "review_likes"
    __table_args__ = (UniqueConstraint("review_id", "user_id", name="uq_review_likes_review_user"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    review_id: Mapped[str] = mapped_column(String, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    review: Mapped[Review] = relationship("Review", back_populates="likes")


class ReviewReply(Base):
    __tablename__ = "review_replies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    review_id: Mapped[str] = mapped_column(String, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    author_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    author_avatar_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    review: Mapped[Review] = relationship("Review", back_populates="replies")


class ReviewModerationLog(Base):
    __tablename__ = "review_moderation_log"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    review_id: Mapped[str] = mapped_column(String, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False)
    moderator_id: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
