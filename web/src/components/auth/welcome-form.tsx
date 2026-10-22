'use client';

import { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import posthog from 'posthog-js';
import { saveProfile } from '@/lib/api/profile-save';
import { SETUP_LATER_COOKIE, SETUP_LATER_SECONDS } from '@/lib/auth/onboarding';
import { isValidKenyanPhone } from '@/lib/utils/phone';

const OTHER = '__other__';
const FIELD =
  'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-ink placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-red-400';

interface WelcomeFormProps {
  next: string;
  firstName: string | null;
  askName: boolean;
  askPhone: boolean;
  askCampus: boolean;
  currentCampusName: string | null;
  campuses: { id: string; name: string }[];
}

type Errors = Partial<Record<'name' | 'phone' | 'campus' | 'form', string>>;

export function WelcomeForm({ next, firstName, askName, askPhone, askCampus, currentCampusName, campuses }: WelcomeFormProps) {
  const known = currentCampusName ? campuses.find((c) => c.name.toLowerCase() === currentCampusName.toLowerCase()) : undefined;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [campusChoice, setCampusChoice] = useState(known ? known.name : currentCampusName ? OTHER : '');
  const [otherCampus, setOtherCampus] = useState(known ? '' : (currentCampusName ?? ''));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const campusValue = campusChoice === OTHER ? otherCampus.trim() : campusChoice;

  function validate(): Errors {
    const found: Errors = {};
    if (askName && name.trim().length < 2) found.name = 'Enter your name.';
    if (askPhone && !isValidKenyanPhone(phone)) found.phone = 'Enter a Kenyan number, like 0712 345 678.';
    if (askCampus && !campusValue) found.campus = campusChoice === OTHER ? 'Type the name of your university.' : 'Choose your campus.';
    return found;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    const result = await saveProfile({
      ...(askName ? { full_name: name.trim() } : {}),
      ...(askPhone ? { phone: phone.trim() } : {}),
      ...(askCampus ? { campus_input: campusValue } : {}),
    });
    if (result.success) {
      posthog.capture('profile_completion_succeeded', { source: 'welcome', campus: campusValue || null });
      window.location.assign(next);
      return; // keep the spinner while the next page loads
    }
    posthog.capture('profile_completion_failed', { source: 'welcome', kind: result.kind, error: result.error });
    setSaving(false);
    if (result.kind === 'auth') {
      window.location.assign(`/auth/login?next=${encodeURIComponent(`/welcome?next=${encodeURIComponent(next)}`)}`);
      return;
    }
    setErrors({ form: `${result.error} You can also skip this and finish later.` });
  }

  function skip() {
    try {
      document.cookie = `${SETUP_LATER_COOKIE}=1; Max-Age=${SETUP_LATER_SECONDS}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    } catch {}
    posthog.capture('profile_completion_skipped', { source: 'welcome' });
    window.location.assign(next);
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Last step</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-ink">
        {firstName ? `Welcome, ${firstName}` : 'Welcome to Rumia'}
      </h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
        Tell us where you study so we show hostels near you, and how caretakers can reach you about viewings.
      </p>

      <form noValidate onSubmit={submit} className="mt-8 space-y-5">
        {askName && (
          <Field id="welcome-name" label="Your name" error={errors.name}>
            <input
              id="welcome-name"
              name="name"
              autoComplete="name"
              autoCapitalize="words"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'welcome-name-error' : undefined}
              className={FIELD}
            />
          </Field>
        )}

        {askPhone && (
          <Field id="welcome-phone" label="Phone number" hint="Only shared with a caretaker when you book a viewing." error={errors.phone}>
            <input
              id="welcome-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'welcome-phone-error' : 'welcome-phone-hint'}
              className={FIELD}
            />
          </Field>
        )}

        {askCampus && (
          <Field id="welcome-campus" label="Your campus" error={errors.campus}>
            <div className="relative">
              <select
                id="welcome-campus"
                name="campus"
                value={campusChoice}
                onChange={(e) => setCampusChoice(e.target.value)}
                aria-invalid={!!errors.campus}
                aria-describedby={errors.campus ? 'welcome-campus-error' : undefined}
                className={`${FIELD} appearance-none pr-10 ${campusChoice ? '' : 'text-slate-400'}`}
              >
                <option value="" disabled>
                  Choose your campus
                </option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value={OTHER}>My university is not listed</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>
            {campusChoice === OTHER && (
              <input
                aria-label="University name"
                name="campus_other"
                autoCapitalize="words"
                placeholder="Type your university"
                value={otherCampus}
                onChange={(e) => setOtherCampus(e.target.value)}
                className={`${FIELD} mt-2`}
              />
            )}
          </Field>
        )}

        {errors.form && (
          <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.form}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button type="button" onClick={skip} disabled={saving} className="min-h-11 px-3 text-sm font-medium text-ink-muted hover:text-ink">
          Skip for now
        </button>
      </div>
    </div>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
