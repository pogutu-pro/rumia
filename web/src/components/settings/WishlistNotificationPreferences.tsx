'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, Mail, MailX, Loader2, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  getNotificationPreferencesAction,
  updateNotificationPreferencesAction,
} from '@/app/actions/notifications';

interface WishlistNotificationPreferencesProps {
  /** Email address shown as the delivery target for email alerts. */
  email?: string | null;
}

/**
 * Wishlist alert channel opt-ins (email + push), backed by the FastAPI
 * notification preferences. Toggles update immediately via PATCH and roll back
 * on failure.
 */
export function WishlistNotificationPreferences({
  email,
}: WishlistNotificationPreferencesProps) {
  const [emailEnabled, setEmailEnabled] = useState<boolean | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState<'email' | 'push' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await getNotificationPreferencesAction();
        if (cancelled) return;
        setEmailEnabled(prefs.wishlist_email_enabled);
        setPushEnabled(prefs.wishlist_push_enabled);
      } catch {
        if (!cancelled) toast.error('Could not load notification preferences');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (channel: 'email' | 'push', value: boolean) => {
      const setter = channel === 'email' ? setEmailEnabled : setPushEnabled;
      setter(value);
      setSaving(channel);
      try {
        const prefs = await updateNotificationPreferencesAction(
          channel === 'email'
            ? { wishlist_email_enabled: value }
            : { wishlist_push_enabled: value },
        );
        setEmailEnabled(prefs.wishlist_email_enabled);
        setPushEnabled(prefs.wishlist_push_enabled);
        toast.success(
          channel === 'email'
            ? value
              ? 'Email alerts enabled'
              : 'Email alerts disabled'
            : value
              ? 'Push alerts enabled'
              : 'Push alerts disabled',
        );
      } catch {
        setter(!value);
        toast.error('Failed to update preferences');
      } finally {
        setSaving(null);
      }
    },
    [],
  );

  if (emailEnabled === null || pushEnabled === null) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100">
        <Loader2 className="h-5 w-5 text-slate-300 animate-spin" />
        <span className="text-sm text-slate-400">Loading wishlist alerts...</span>
      </div>
    );
  }

  const toggle = (channel: 'email' | 'push') =>
    save(channel, channel === 'email' ? !emailEnabled : !pushEnabled);

  return (
    <div className="space-y-3">
      {/* Email alerts */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
          {emailEnabled ? (
            <Mail className="h-5 w-5 text-emerald-600" />
          ) : (
            <MailX className="h-5 w-5 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Wishlist email alerts</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {emailEnabled
              ? email
                ? `On — alerts go to ${email}`
                : 'On — you\'ll get an email when a wishlisted hostel changes.'
              : 'Off — no emails about your wishlist.'}
          </p>
        </div>
        <button
          onClick={() => toggle('email')}
          disabled={saving === 'email'}
          className={`shrink-0 h-9 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-60 ${
            emailEnabled
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {saving === 'email' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
          ) : emailEnabled ? (
            'Disable'
          ) : (
            'Enable'
          )}
        </button>
      </div>

      {/* Push alerts */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-100">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
          {pushEnabled ? (
            <BellRing className="h-5 w-5 text-emerald-600" />
          ) : (
            <BellOff className="h-5 w-5 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Wishlist push alerts</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {pushEnabled
              ? 'On — you\'ll be alerted in-app and on your devices when a wishlisted hostel changes.'
              : 'Off — no push alerts about your wishlist.'}
          </p>
        </div>
        <button
          onClick={() => toggle('push')}
          disabled={saving === 'push'}
          className={`shrink-0 h-9 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-60 ${
            pushEnabled
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
        >
          {saving === 'push' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
          ) : pushEnabled ? (
            'Disable'
          ) : (
            'Enable'
          )}
        </button>
      </div>
    </div>
  );
}