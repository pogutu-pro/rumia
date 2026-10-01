from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import AuthenticatedUser, require_roles
from app.features.legal.schemas import LegalDocAdminRead, LegalDocRead, LegalDraftUpdate
from app.features.legal.service import LegalService

router = APIRouter(prefix="/legal", tags=["Legal Documents"])


@router.get(
    "/terms",
    response_model=LegalDocRead,
    status_code=status.HTTP_200_OK,
    summary="Get Terms & Conditions",
    description="Fetch published Terms & Conditions document. Public.",
)
async def get_terms(db: AsyncSession = Depends(get_db_session, scope="function")) -> LegalDocRead:
    doc = await LegalService.get_published_doc(db, "terms")
    return LegalDocRead.model_validate(doc)


@router.get(
    "/privacy",
    response_model=LegalDocRead,
    status_code=status.HTTP_200_OK,
    summary="Get Privacy Policy",
    description="Fetch published Privacy Policy document. Public.",
)
async def get_privacy(db: AsyncSession = Depends(get_db_session, scope="function")) -> LegalDocRead:
    doc = await LegalService.get_published_doc(db, "privacy")
    return LegalDocRead.model_validate(doc)


@router.get(
    "/admin",
    response_model=List[LegalDocAdminRead],
    status_code=status.HTTP_200_OK,
    summary="List Legal Documents (Admin)",
    description="Fetch all legal documents with draft content. Admin only.",
)
async def list_admin_docs(
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> List[LegalDocAdminRead]:
    docs = await LegalService.list_admin_docs(db, user)
    emails = await LegalService.updater_emails(db, [d.updated_by for d in docs if d.updated_by])
    out = []
    for d in docs:
        row = LegalDocAdminRead.model_validate(d)
        row.updater_email = emails.get(str(d.updated_by)) if d.updated_by else None
        out.append(row)
    return out


@router.patch(
    "/{doc_type}/draft",
    response_model=LegalDocAdminRead,
    status_code=status.HTTP_200_OK,
    summary="Save Legal Document Draft",
    description="Save draft edit of terms or privacy doc. Admin only.",
)
async def save_draft(
    doc_type: str,
    data: LegalDraftUpdate,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> LegalDocAdminRead:
    doc = await LegalService.save_draft(db, user, doc_type, data.draft_content)
    return LegalDocAdminRead.model_validate(doc)


@router.post(
    "/{doc_type}/publish",
    response_model=LegalDocAdminRead,
    status_code=status.HTTP_200_OK,
    summary="Publish Legal Document",
    description="Publish draft legal document live to public pages. Admin only.",
)
async def publish_doc(
    doc_type: str,
    user: AuthenticatedUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session, scope="function"),
) -> LegalDocAdminRead:
    doc = await LegalService.publish_doc(db, user, doc_type)
    return LegalDocAdminRead.model_validate(doc)
