'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Megaphone,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Info,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  deleteAnnouncementAction,
} from '@/app/actions/announcements';
import type { AnnouncementType } from '@/types';

interface CampusOption {
  id: string;
  name: string;
  slug: string;
}

interface AnnouncementRow {
  id: string;
  campus_id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  campuses?: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[];
}

interface AnnouncementsClientProps {
  campuses: CampusOption[];
  isSuperAdmin: boolean;
  initialAnnouncements: AnnouncementRow[];
}

const DURATION_PRESETS: { label: string; ms: number }[] = [
  { label: '12 hours', ms: 12 * 60 * 60 * 1000 },
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '2 weeks', ms: 14 * 24 * 60 * 60 * 1000 },
  { label: '1 month', ms: 30 * 24 * 60 * 60 * 1000 },
];

const TYPE_OPTIONS: {
  value: AnnouncementType;
  label: string;
  icon: typeof Info;
  activeClass: string;
  badgeClass: string;
}[] = [
  {
    value: 'info',
    label: 'Info',
    icon: Info,
    activeClass: 'bg-sky-600 text-white border-sky-600',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  {
    value: 'warning',
    label: 'Warning',
    icon: AlertTriangle,
    activeClass: 'bg-amber-600 text-white border-amber-600',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  {
    value: 'encouragement',
    label: 'Encouragement',
    icon: Sparkles,
    activeClass: 'bg-emerald-600 text-white border-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
];

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}

function formatExpiry(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
}

interface FormState {
  campus_id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  expires_at: string;
}

function emptyForm(defaultCampusId: string): FormState {
  const now = new Date();
  const defaultExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    campus_id: defaultCampusId,
    title: '',
    message: '',
    type: 'info',
    expires_at: toLocalInputValue(defaultExpiry.toISOString()),
  };
}

export function AnnouncementsClient({
  campuses,
  isSuperAdmin,
  initialAnnouncements,
}: AnnouncementsClientProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>(
    initialAnnouncements,
  );
  const [editing, setEditing] = useState<'new' | AnnouncementRow | null>(null);
  const [form, setForm] = useState<FormState>(
    () => emptyForm(campuses[0]?.id || ''),
  );
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const defaultCampusId = campuses[0]?.id || '';

  const activeCount = useMemo(
    () => announcements.filter((a) => !isExpired(a.expires_at)).length,
    [announcements],
  );

  function openCreate() {
    setErrorMsg(null);
    setSuccessMsg(null);
    setForm(emptyForm(defaultCampusId));
    setEditing('new');
  }

  function openEdit(row: AnnouncementRow) {
    setErrorMsg(null);
    setSuccessMsg(null);
    setForm({
      campus_id: row.campus_id,
      title: row.title,
      message: row.message,
      type: row.type,
      expires_at: toLocalInputValue(row.expires_at),
    });
    setEditing(row);
  }

  function handleSave() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!form.campus_id) {
      setErrorMsg('Please choose a campus for this announcement.');
      return;
    }
    if (!form.title.trim()) {
      setErrorMsg('Please enter an announcement title.');
      return;
    }
    if (!form.message.trim()) {
      setErrorMsg('Please enter an announcement message.');
      return;
    }
    const expiresMs = new Date(form.expires_at).getTime();
    if (Number.isNaN(expiresMs) || expiresMs <= Date.now()) {
      setErrorMsg('Expiration must be in the future.');
      return;
    }

    const payload = {
      campusId: form.campus_id,
      title: form.title.trim(),
      message: form.message.trim(),
      type: form.type,
      expiresAt: fromLocalInputValue(form.expires_at),
    };

    startTransition(async () => {
      if (editing && editing !== 'new') {
        const res = await updateAnnouncementAction(editing.id, payload);
        if (!res.success) {
          setErrorMsg(res.error);
          return;
        }
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.id === editing.id
              ? {
                  ...a,
                  ...payload,
                  campus_id: payload.campusId,
                  expires_at: payload.expiresAt,
                  updated_at: new Date().toISOString(),
                }
              : a,
          ),
        );
        setSuccessMsg('Announcement updated successfully.');
      } else {
        const res = await createAnnouncementAction(payload);
        if (!res.success) {
          setErrorMsg(res.error);
          return;
        }
        const newRow: AnnouncementRow = {
          id: `temp-${Date.now()}`,
          campus_id: payload.campusId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expires_at: payload.expiresAt,
          campuses: campuses.find((c) => c.id === payload.campusId),
        };
        setAnnouncements((prev) => [newRow, ...prev]);
        setSuccessMsg('Announcement published successfully.');
      }
      setEditing(null);
    });
  }

  function handleDelete(row: AnnouncementRow) {
    if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await deleteAnnouncementAction(row.id);
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== row.id));
      setSuccessMsg('Announcement deleted successfully.');
    });
  }

  function campusName(campusId: string): string {
    return campuses.find((c) => c.id === campusId)?.name || '—';
  }

  return (
    <div className="space-y-5">
      {/* Summary + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {activeCount} active announcement{activeCount === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeCount > 0
                ? 'Live at the top of the public site until their expiry time.'
                : 'No announcements are currently visible to the public.'}
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Announcement list */}
      {announcements.length === 0 ? (
        <div className="text-center text-sm text-slate-500 py-14 border border-dashed border-slate-200 rounded-2xl bg-white">
          <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">
            No announcements yet.
          </p>
          <p className="text-slate-400 mt-1">
            Create one and it will appear at the top of the public site.
          </p>
          <button
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Create your first announcement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((row) => {
            const expired = isExpired(row.expires_at);
            const typeOption =
              TYPE_OPTIONS.find((t) => t.value === row.type) ??
              TYPE_OPTIONS[0];
            const TypeIcon = typeOption.icon;

            return (
              <div
                key={row.id}
                className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs ${
                  expired ? 'opacity-80' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeOption.badgeClass}`}
                      >
                        <TypeIcon className="h-3 w-3" />
                        {typeOption.label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          expired
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}
                      >
                        {expired ? 'Expired' : 'Active'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-2">
                      {row.title}
                    </h3>
                    <p
                      className={`text-xs text-slate-600 leading-relaxed mt-1 whitespace-pre-line ${
                        expired ? 'line-clamp-2' : ''
                      }`}
                    >
                      {row.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(row)}
                      disabled={isPending}
                      aria-label={`Edit ${row.title}`}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={isPending}
                      aria-label={`Delete ${row.title}`}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
                  <span>{campusName(row.campus_id)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {expired ? 'Expired' : 'Visible'} until{' '}
                    {formatExpiry(row.expires_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editing === 'new'
                  ? 'New Announcement'
                  : 'Edit Announcement'}
              </h3>
              <button
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {campuses.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Campus
                  </label>
                  <select
                    value={form.campus_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, campus_id: e.target.value }))
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Water supply maintenance this weekend"
                  maxLength={120}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Message
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, message: e.target.value }))
                  }
                  placeholder="Share the details students need to know."
                  rows={4}
                  maxLength={2000}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const selected = form.type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, type: opt.value }))
                        }
                        className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                          selected
                            ? opt.activeClass
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  How long should it remain visible?
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          expires_at: toLocalInputValue(
                            new Date(new Date().getTime() + preset.ms).toISOString(),
                          ),
                        }))
                      }
                      className="h-9 px-3 rounded-full border border-slate-300 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Exact expiry date and time
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, expires_at: e.target.value }))
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    The announcement automatically disappears from the public
                    site at this time.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="h-10 px-4 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  isPending ||
                  !form.title.trim() ||
                  !form.message.trim() ||
                  !form.campus_id
                }
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing === 'new' ? 'Publish' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
