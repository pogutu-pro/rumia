'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bold,
  CalendarDays,
  FileText,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Pilcrow,
  Redo2,
  Save,
  Send,
  ShieldCheck,
  Underline,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  publishLegalDocumentAction,
  saveLegalDraftAction,
} from '@/app/actions/legal-documents';
import { stripHtml } from '@/lib/utils/sanitize-html';
import type { LegalDocumentStatus, LegalDocumentType } from '@/types';

interface DocProp {
  id: string;
  type: LegalDocumentType;
  content: string;
  draft_content: string | null;
  status: LegalDocumentStatus;
  effective_date: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  updater_email?: string | null;
}

interface DocData {
  type: LegalDocumentType;
  id: string | null;
  title: string;
  subtitle: string;
  status: LegalDocumentStatus;
  content: string;
  draftContent: string | null;
  effectiveDate: string | null;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

const DOC_META: Record<
  LegalDocumentType,
  { title: string; subtitle: string }
> = {
  terms: {
    title: 'Terms & Conditions',
    subtitle: 'Terms of Service shown at /terms',
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'Privacy Policy shown at /policy',
  },
};

function buildDoc(doc: DocProp | null, type: LegalDocumentType): DocData {
  return {
    type,
    id: doc?.id ?? null,
    title: DOC_META[type].title,
    subtitle: DOC_META[type].subtitle,
    status: doc?.status ?? 'draft',
    content: doc?.content ?? '',
    draftContent: doc?.draft_content ?? null,
    effectiveDate: doc?.effective_date ?? null,
    updatedAt: doc?.updated_at ?? null,
    updatedByEmail: doc?.updater_email ?? null,
  };
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, 'MMM d, yyyy');
}

function truncatePreview(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd() + '…';
}

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />;
}

export function LegalDocumentsClient({
  terms,
  privacy,
}: {
  terms: DocProp | null;
  privacy: DocProp | null;
}) {
  const [docs, setDocs] = useState<Record<LegalDocumentType, DocData>>(() => ({
    terms: buildDoc(terms, 'terms'),
    privacy: buildDoc(privacy, 'privacy'),
  }));

  const [activeType, setActiveType] = useState<LegalDocumentType | null>(null);
  const [editorHtml, setEditorHtml] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const activeDoc = useMemo(
    () => (activeType ? docs[activeType] : null),
    [activeType, docs],
  );

  // Hydrate the contentEditable only when switching documents; the editor is
  // otherwise uncontrolled so its caret is never disturbed by React renders.
  useEffect(() => {
    if (!activeType) return;
    const el = editorRef.current;
    if (el) el.innerHTML = editorHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  // Warn before the whole page navigates away with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function openEditor(type: LegalDocumentType) {
    const doc = docs[type];
    setEditorHtml(doc.draftContent ?? doc.content);
    setEffectiveDate(doc.effectiveDate ?? '');
    setDirty(false);
    setActiveType(type);
  }

  function requestCloseEditor() {
    if (dirty) {
      setShowDiscardConfirm(true);
      return;
    }
    setActiveType(null);
  }

  function closeEditorForReal() {
    setShowDiscardConfirm(false);
    setDirty(false);
    setActiveType(null);
  }

  function syncFromDom() {
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
      setDirty(true);
    }
  }

  function execCommand(command: string, value: string | null = null) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, value ?? undefined);
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
      setDirty(true);
    }
  }

  function formatBlock(tag: 'p' | 'h2' | 'h3') {
    execCommand('formatBlock', `<${tag}>`);
  }

  function insertLink() {
    const answer = window.prompt('Enter link URL (https://…):');
    if (!answer) return;
    let href = answer.trim();
    if (
      !/^(https?:|mailto:|tel:)/i.test(href) &&
      !href.startsWith('/') &&
      !href.startsWith('#')
    ) {
      href = 'https://' + href;
    }
    execCommand('createLink', href);
    // strip any rel/target the browser left behind; sanitizer re-adds safe ones
    document.querySelectorAll('a[href]').forEach((a) => {
      if (a.getAttribute('href') === href) {
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
    syncFromDom();
  }

  function applyResult(
    type: LegalDocumentType,
    patch: (doc: DocData) => DocData,
  ) {
    setDocs((prev) => ({ ...prev, [type]: patch(prev[type]) }));
  }

  async function handleSaveDraft() {
    if (!activeType || !activeDoc) return;
    setSaving(true);
    try {
      const res = await saveLegalDraftAction({
        type: activeType,
        content: editorHtml,
        effectiveDate: effectiveDate || undefined,
      });
      if (!res.success) {
        toast.error(res.error);
        setSaving(false);
        return;
      }
      const now = new Date().toISOString();
      const ed = effectiveDate || null;
      applyResult(activeType, (doc) => {
        if (res.status === 'published') {
          return {
            ...doc,
            status: 'published',
            draftContent: editorHtml,
            effectiveDate: ed,
            updatedAt: now,
          };
        }
        return {
          ...doc,
          status: 'draft',
          content: editorHtml,
          draftContent: null,
          effectiveDate: ed,
          updatedAt: now,
        };
      });
      setDirty(false);
      toast.success(
        res.status === 'published'
          ? 'Draft saved — the live document is unchanged.'
          : 'Draft saved.',
      );
    } catch {
      toast.error('Failed to save the draft. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!activeType || !activeDoc) return;
    setShowPublishConfirm(false);
    setPublishing(true);
    try {
      const res = await publishLegalDocumentAction({
        type: activeType,
        content: editorHtml,
        effectiveDate: effectiveDate || undefined,
      });
      if (!res.success) {
        toast.error(res.error);
        setPublishing(false);
        return;
      }
      const now = new Date().toISOString();
      const ed = effectiveDate || null;
      applyResult(activeType, (doc) => ({
        ...doc,
        status: 'published',
        content: editorHtml,
        draftContent: null,
        effectiveDate: ed,
        updatedAt: now,
      }));
      setDirty(false);
      toast.success('Published. The live page has been updated.');
    } catch {
      toast.error('Failed to publish the document. Please try again.');
    } finally {
      setPublishing(false);
    }
  }

  const hasDraftPending =
    activeDoc?.status === 'published' && activeDoc.draftContent !== null;
  const hasContent = editorHtml.replace(/<[^>]*>/g, '').trim().length > 0;

  if (activeType && activeDoc) {
    return (
      <div>
        <HeaderRow onBack={requestCloseEditor} backLabel="All documents" />

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
            {activeDoc.title}
          </h1>
          {activeDoc.status === 'published' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Not published
            </span>
          )}
          {hasDraftPending && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Unpublished draft pending
            </span>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <label className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => {
                setEffectiveDate(e.target.value);
                setDirty(true);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <span>Effective date</span>
          </label>
          {activeDoc.updatedAt ? (
            <span>Last saved: {formatShortDate(activeDoc.updatedAt)}</span>
          ) : null}
        </div>

        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
          <ToolbarButton onClick={() => execCommand('undo')} label="Undo">
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('redo')} label="Redo">
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton
            onClick={() => formatBlock('p')}
            label="Paragraph"
          >
            <Pilcrow className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatBlock('h2')} label="Heading 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatBlock('h3')} label="Heading 3">
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton onClick={() => execCommand('bold')} label="Bold">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('italic')} label="Italic">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('underline')} label="Underline">
            <Underline className="h-4 w-4" />
          </ToolbarButton>
          <Divider />
          <ToolbarButton onClick={() => execCommand('insertUnorderedList')} label="Bullet list">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('insertOrderedList')} label="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={insertLink} label="Link">
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Editor */}
        <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm">
          {!hasContent && (
            <div className="pointer-events-none absolute inset-0 flex items-start px-5 pt-4 text-sm text-slate-400">
              Start writing your {activeDoc.title.toLowerCase()}… Use the toolbar
              above for headings, lists and links.
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={`${activeDoc.title} content`}
            onInput={syncFromDom}
            onBlur={syncFromDom}
            className="legal-document-prose scrollbar-custom min-h-[55vh] w-full overflow-y-auto rounded-xl px-5 py-4 text-[15px] leading-relaxed focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex-1 text-xs text-slate-500">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </div>
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || publishing || !dirty}
            isLoading={saving}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Save Draft
          </Button>
          <Button
            onClick={() => setShowPublishConfirm(true)}
            disabled={publishing || saving || !dirty}
            isLoading={publishing}
            leftIcon={<Send className="h-4 w-4" />}
          >
            {activeDoc.status === 'published' ? 'Publish Changes' : 'Publish'}
          </Button>
        </div>

        <ConfirmationDialog
          isOpen={showPublishConfirm}
          onClose={() => setShowPublishConfirm(false)}
          onConfirm={handlePublish}
          isConfirming={publishing}
          title="Publish this document?"
          description={
            <>
              This will immediately replace the live{' '}
              <strong>{activeDoc.title}</strong> shown to all users on
              {activeType === 'terms' ? ' /terms' : ' /policy'}. The previous
              content cannot be restored from the dashboard. Continue?
            </>
          }
          confirmText="Publish"
          cancelText="Cancel"
          variant="warning"
        />

        <ConfirmationDialog
          isOpen={showDiscardConfirm}
          onClose={() => setShowDiscardConfirm(false)}
          onConfirm={closeEditorForReal}
          title="Discard unsaved changes?"
          description="You have unsaved edits in this document. Leaving now will discard them."
          confirmText="Discard changes"
          cancelText="Keep editing"
          variant="danger"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Legal / Policies
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage the Terms &amp; Conditions and Privacy Policy shown on the
          public website. Changes you publish go live immediately — no code
          changes needed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(['terms', 'privacy'] as LegalDocumentType[]).map((type) => {
          const doc = docs[type];
          const previewSource = doc.draftContent ?? doc.content;
          const preview = previewSource
            ? truncatePreview(stripHtml(previewSource), 180)
            : 'No content yet — click Edit to get started.';
          const hasPendingDraft = doc.status === 'published' && doc.draftContent;

          return (
            <Card key={type} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    {doc.type === 'privacy' ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {doc.title}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {doc.subtitle}
                    </CardDescription>
                  </div>
                </div>
                {doc.status === 'published' ? (
                  <Badge published>
                    Published
                  </Badge>
                ) : (
                  <Badge>Not published</Badge>
                )}
              </CardHeader>

              <CardContent className="flex-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    {doc.updatedAt
                      ? `Last updated: ${formatShortDate(doc.updatedAt)}`
                      : 'Not updated yet'}
                    {doc.updatedByEmail ? ` by ${doc.updatedByEmail}` : ''}
                  </span>
                  {hasPendingDraft && (
                    <span className="text-blue-600 font-semibold">
                      Unpublished draft
                    </span>
                  )}
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                  {preview}
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="charcoal"
                    size="sm"
                    onClick={() => openEditor(type)}
                  >
                    Edit
                  </Button>
                  {doc.status === 'draft' ? (
                    <span className="text-xs text-slate-400">
                      Draft — not shown publicly
                    </span>
                  ) : hasPendingDraft ? (
                    <span className="text-xs text-slate-400">
                      Draft edits pending — live version is shown publicly
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function HeaderRow({
  onBack,
  backLabel,
}: {
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" />
      {backLabel}
    </button>
  );
}

function Badge({
  children,
  published = false,
}: {
  children: React.ReactNode;
  published?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        published
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          published ? 'bg-emerald-500' : 'bg-amber-500'
        }`}
      />
      {children}
    </span>
  );
}