import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenException, NotFoundException
from app.core.security import AuthenticatedUser
from app.features.legal.models import LegalDocument


class LegalService:
    @staticmethod
    async def get_published_doc(db: AsyncSession, doc_type: str) -> LegalDocument:
        res = await db.execute(select(LegalDocument).where(LegalDocument.type == doc_type, LegalDocument.status == "published"))
        doc = res.scalar_one_or_none()
        if not doc:
            # Never fall back to an unpublished (draft) document on the public endpoint.
            raise NotFoundException(f"Legal document '{doc_type}' not found")
        return doc

    @staticmethod
    async def list_admin_docs(db: AsyncSession, user: AuthenticatedUser) -> List[LegalDocument]:
        if not user.is_admin:
            raise ForbiddenException("Only admins can manage legal documents")

        res = await db.execute(select(LegalDocument).order_by(LegalDocument.type.asc()))
        return list(res.scalars().all())

    @staticmethod
    async def updater_emails(db: AsyncSession, user_ids: List[str]) -> dict:
        """user id -> email, for showing who last edited a document."""
        if not user_ids:
            return {}
        from app.features.profiles.models import UserProfile

        res = await db.execute(select(UserProfile.id, UserProfile.email).where(UserProfile.id.in_(user_ids)))
        return {str(i): e for i, e in res.all() if e}

    @staticmethod
    async def save_draft(db: AsyncSession, user: AuthenticatedUser, doc_type: str, draft_content: str) -> LegalDocument:
        if not user.is_admin:
            raise ForbiddenException("Only admins can manage legal documents")

        res = await db.execute(select(LegalDocument).where(LegalDocument.type == doc_type))
        doc = res.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if not doc:
            doc = LegalDocument(
                id=str(uuid.uuid4()),
                type=doc_type,
                content=draft_content,
                draft_content=draft_content,
                status="draft",
                created_at=now,
                updated_at=now,
                updated_by=user.id,
            )
            db.add(doc)
        else:
            doc.draft_content = draft_content
            doc.updated_at = now
            doc.updated_by = user.id

        await db.flush()
        return doc

    @staticmethod
    async def publish_doc(db: AsyncSession, user: AuthenticatedUser, doc_type: str) -> LegalDocument:
        if not user.is_admin:
            raise ForbiddenException("Only admins can publish legal documents")

        res = await db.execute(select(LegalDocument).where(LegalDocument.type == doc_type))
        doc = res.scalar_one_or_none()
        if not doc:
            raise NotFoundException(f"Legal document '{doc_type}' not found")

        now = datetime.now(timezone.utc)
        if doc.draft_content:
            doc.content = doc.draft_content
        doc.status = "published"
        doc.published_at = now
        doc.updated_at = now
        doc.updated_by = user.id

        await db.flush()
        return doc
