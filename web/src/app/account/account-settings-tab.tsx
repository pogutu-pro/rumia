'use client';

import { useEffect, useRef, useState } from 'react';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { WishlistNotificationPreferences } from '@/components/settings/WishlistNotificationPreferences';
import { saveProfile, type ProfileSaveInput } from '@/lib/api/profile-save';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { AccountPageHeader, SettingsGroup, SignOutRow } from './account-ui';

interface AccountSettingsTabProps {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    home_campus_id?: string | null;
    home_campus_name?: string | null;
  };
  campuses?: Array<{ id: string; name: string }>;
  onProfileUpdate: (updated: {
    full_name: string;
    phone: string;
    home_campus_id?: string | null;
    home_campus_name?: string | null;
    home_campus_confirmed_at?: string | null;
  }) => void;
  onBackToOverview?: () => void;
}

type FieldId = 'full_name' | 'phone' | 'campus';

interface FieldConfig {
  id: FieldId;
  label: string;
  hint: string;
  placeholder: string;
  type: 'text' | 'tel';
  autoComplete: string;
}

const FIELDS: FieldConfig[] = [
  {
    id: 'full_name',
    label: 'Full name',
    hint: 'The name agents see when you book a viewing.',
    placeholder: 'Your full name',
    type: 'text',
    autoComplete: 'name',
  },
  {
    id: 'phone',
    label: 'Phone number',
    hint: 'Agents and Rumia managers use this to reach you on WhatsApp.',
    placeholder: '0712 345 678',
    type: 'tel',
    autoComplete: 'tel',
  },
  {
    id: 'campus',
    label: 'University or campus',
    hint: 'We use it to show hostels near you first.',
    placeholder: 'Start typing or choose from the list',
    type: 'text',
    autoComplete: 'off',
  },
];

/**
 * One field shown as a read-only row with its own Edit. Editing opens the input in place with
 * Save / Cancel, and only one row is open at a time, so the page never turns into a long form.
 */
function EditableRow({
  field,
  value,
  editing,
  locked,
  onEdit,
  onCancel,
  onSave,
  campusListId,
}: {
  field: FieldConfig;
  value: string;
  editing: boolean;
  locked: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (next: string) => Promise<boolean>;
  campusListId?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `settings-${field.id}`;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    setDraft(value);
    onEdit();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (!ok) inputRef.current?.focus();
  };

  return (
    <div className={editing ? 'px-4 py-4 sm:px-5' : 'px-4 py-3.5 sm:px-5'}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={editing ? inputId : undefined} className="block text-[15px] font-semibold text-ink">
            {field.label}
          </label>
          {editing ? (
            <p className="mt-0.5 text-[13px] text-ink-muted">{field.hint}</p>
          ) : (
            <p className={`mt-0.5 truncate text-sm ${value ? 'text-ink-muted' : 'italic text-ink-muted/80'}`}>
              {value || 'Not provided'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={editing ? onCancel : startEdit}
          disabled={locked || saving}
          className="inline-flex min-h-11 shrink-0 items-center px-1 text-sm font-semibold text-ink underline underline-offset-4 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {editing ? 'Cancel' : value ? 'Edit' : 'Add'}
        </button>
      </div>

      {editing && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <input
            ref={inputRef}
            id={inputId}
            type={field.type}
            inputMode={field.type === 'tel' ? 'tel' : undefined}
            autoComplete={field.autoComplete}
            list={campusListId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={field.placeholder}
            className="h-12 w-full rounded-xl border border-line bg-raised px-3.5 text-base text-ink placeholder:text-ink-muted/70 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim() || draft.trim() === value}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-page transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {saving ? 'Saving' : 'Save'}
          </button>
        </form>
      )}
    </div>
  );
}

export function AccountSettingsTab({
  profile,
  campuses = [],
  onProfileUpdate,
  onBackToOverview,
}: AccountSettingsTabProps) {
  const [editing, setEditing] = useState<FieldId | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const campusName =
    profile.home_campus_name ??
    (profile.home_campus_id ? campuses.find((c) => c.id === profile.home_campus_id)?.name : null) ??
    '';

  const values: Record<FieldId, string> = {
    full_name: profile.full_name ?? '',
    phone: profile.phone ?? '',
    campus: campusName,
  };

  // "Notifications" on the hub deep-links here.
  useEffect(() => {
    if (window.location.hash === '#notifications') {
      notificationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const saveField = async (id: FieldId, next: string): Promise<boolean> => {
    const input: ProfileSaveInput =
      id === 'full_name' ? { full_name: next } : id === 'phone' ? { phone: next } : { campus_input: next };
    const result = await saveProfile(input);
    if (!result.success) {
      toast.error(result.error || 'Could not save. Please try again.');
      return false;
    }
    onProfileUpdate({
      full_name: result.updated.full_name ?? values.full_name,
      phone: result.updated.phone ?? values.phone,
      ...(result.updated.home_campus_id !== undefined ? { home_campus_id: result.updated.home_campus_id } : {}),
      ...(result.updated.home_campus_name !== undefined ? { home_campus_name: result.updated.home_campus_name } : {}),
      ...(result.updated.home_campus_confirmed_at !== undefined
        ? { home_campus_confirmed_at: result.updated.home_campus_confirmed_at }
        : {}),
    });
    toast.success('Saved');
    setEditing(null);
    return true;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <AccountPageHeader
        title="Personal info"
        description="Your contact details and campus, used for tour bookings and hostel requests."
        onBack={onBackToOverview}
      />

      <SettingsGroup title="Profile">
        {FIELDS.map((field) => (
          <EditableRow
            key={field.id}
            field={field}
            value={values[field.id]}
            editing={editing === field.id}
            locked={editing !== null && editing !== field.id}
            onEdit={() => setEditing(field.id)}
            onCancel={() => setEditing(null)}
            onSave={(next) => saveField(field.id, next)}
            campusListId={field.id === 'campus' ? 'settings-campus-list' : undefined}
          />
        ))}
        <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">Email address</p>
            <p className="mt-0.5 truncate text-sm text-ink-muted">{profile.email}</p>
          </div>
          <span className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-ink-muted" title="Your sign-in email">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Sign-in email
          </span>
        </div>
      </SettingsGroup>
      <datalist id="settings-campus-list">
        {campuses.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>

      <div id="notifications" ref={notificationsRef} className="scroll-mt-[calc(var(--shell-header-h)+1rem)]">
        <SettingsGroup title="Notifications">
          <div className="space-y-3 p-3 sm:p-4">
            <p className="px-1 text-[13px] text-ink-muted">
              Alerts for tour updates and price drops on places in your wishlist.
            </p>
            <NotificationSettings />
            <WishlistNotificationPreferences email={profile.email} />
          </div>
        </SettingsGroup>
      </div>

      <SettingsGroup title="Session">
        <SignOutRow />
      </SettingsGroup>
    </div>
  );
}
