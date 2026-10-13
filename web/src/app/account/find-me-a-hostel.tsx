'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Loader2,
  CheckCircle2,
  Phone,
  Send,
  Clock,
  X,
  Pencil,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/auth/client';
import { campusesApi } from '@/lib/api/campuses';
import { zonesApi } from '@/lib/api/zones';
import { signInWithGoogle } from '@/lib/auth/actions';
import {
  createHostelRequestAction,
  getMyHostelRequestsAction,
  cancelMyHostelRequestAction,
  updateMyHostelRequestAction,
  deleteMyHostelRequestAction,
} from '@/app/actions/hostel-requests';
import {
  BUDGET_OPTIONS,
  GENDER_OPTIONS,
  ROOM_TYPE_OPTIONS,
  FURNISHING_OPTIONS,
  STAY_PREFERENCE_OPTIONS,
  HOSTEL_REQUEST_FEE,
  getHostelRequestStatus,
  budgetLabel,
  genderLabel,
  roomTypeLabel,
  furnishingLabel,
  stayPreferenceLabel,
} from '@/lib/constants/hostel-requests';
import type {
  HostelRequest,
  HostelRequestGender,
  HostelRequestRoomType,
  HostelRequestFurnishing,
  HostelRequestStayPreference,
  CreateHostelRequestInput,
} from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';

const PENDING_REQUEST_KEY = 'rumia_pending_hostel_request';

interface FindMeAHostelProps {
  variant?: 'dashboard' | 'home';
  studentName?: string;
  studentPhone?: string | null;
  campusId?: string | null;
  campusName?: string | null;
  campusFee?: number;
}

interface EditDraft {
  id: string;
  phone: string;
  preferred_zone: string;
  budget_range: string;
  gender: HostelRequestGender;
  room_type: HostelRequestRoomType;
  furnishing: HostelRequestFurnishing;
  stay_preference: HostelRequestStayPreference;
  move_in_date: string;
  additional_requirements: string;
}

export function FindMeAHostel({
  variant = 'dashboard',
  studentPhone = null,
  campusId = null,
  campusName = null,
  campusFee: campusFeeProp,
}: FindMeAHostelProps) {
  const isHome = variant === 'home';
  const [authClient] = useState(() => createClient());

  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [requests, setRequests] = useState<HostelRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<HostelRequest | null>(null);
  const [campusFee, setCampusFee] = useState<number | null>(campusFeeProp ?? null);

  // Pending draft left by the homepage guest flow: after Google sign-in the user
  // lands on the account page and this request is submitted automatically.
  const [draft, setDraft] = useState<CreateHostelRequestInput | null>(null);
  const draftHandled = useRef(false);

  // Inline validation only appears once the person has tried to submit.
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Payment acceptance modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAccepted, setPaymentAccepted] = useState(false);
  const [pendingDraftInput, setPendingDraftInput] = useState<CreateHostelRequestInput | null>(null);
  // Returns true only after hydration, so portal rendering never runs on SSR.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Form state
  const [phone, setPhone] = useState<string>(studentPhone || '');
  const [preferredZone, setPreferredZone] = useState<string>('__none__');
  const [budget, setBudget] = useState<string>('');
  const [gender, setGender] = useState<HostelRequestGender>('no_preference');
  const [roomType, setRoomType] = useState<HostelRequestRoomType>('no_preference');
  const [furnishing, setFurnishing] = useState<HostelRequestFurnishing>('no_preference');
  const [stayPreference, setStayPreference] =
    useState<HostelRequestStayPreference>('no_preference');
  const [moveInDate, setMoveInDate] = useState<string>('');
  const [requirements, setRequirements] = useState<string>('');

  // Edit modal state
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const hasCampus = !!campusId;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingRequests(true);
      const [zoneRows, reqs, feeCampus] = await Promise.all([
        hasCampus
          ? zonesApi.list(campusId!).catch(() => null)
          : Promise.resolve(null),
        isHome
          ? Promise.resolve([] as HostelRequest[])
          : getMyHostelRequestsAction(),
        !campusFeeProp && campusId
          ? campusesApi
              .list('active,coming_soon')
              .then((all) => all.find((c) => c.id === campusId) ?? null)
              .catch(() => null)
          : Promise.resolve(null),
      ]);
      if (cancelled) return;

      if (zoneRows) setZones(zoneRows.map((z) => ({ id: z.id, name: z.name })));
      setRequests(reqs);

      // Resolve the campus fee from DB if not provided as a prop.
      if (!campusFeeProp && feeCampus) {
        setCampusFee(feeCampus.hostel_finding_fee ?? HOSTEL_REQUEST_FEE);
      } else if (!campusFeeProp) {
        setCampusFee(HOSTEL_REQUEST_FEE);
      }

      // Pick up a pending draft left by the homepage guest flow (account page
      // only) and pre-fill the form so the user sees exactly what they chose.
      if (!isHome && typeof window !== 'undefined') {
        try {
          const raw = sessionStorage.getItem(PENDING_REQUEST_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as CreateHostelRequestInput;
            if (parsed && typeof parsed.phone === 'string') {
              setDraft(parsed);
              setPhone(parsed.phone || studentPhone || '');
              setPreferredZone(parsed.preferred_zone || '__none__');
              setBudget(parsed.budget_range || '');
              setGender(parsed.gender || 'no_preference');
              setRoomType(parsed.room_type || 'no_preference');
              setFurnishing(parsed.furnishing || 'no_preference');
              setStayPreference(parsed.stay_preference || 'no_preference');
              setMoveInDate(parsed.move_in_date || '');
              setRequirements(parsed.additional_requirements || '');
            }
          }
        } catch {
          // Corrupt draft → ignore, user can resubmit from scratch.
        }
      }

      setLoadingRequests(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hasCampus, campusId, authClient, isHome, studentPhone, campusFeeProp]);

  // Auto-submit the pending draft once we know the user has a campus. For brand
  // new users the profile-completion modal blocks with empty campus; the moment
  // it completes, hasCampus flips true and this fires — smooth and continuous.
  useEffect(() => {
    const pending = draft;
    if (!pending || isHome || draftHandled.current) return;
    if (!hasCampus || submitting) return;
    if ((pending.phone || '').replace(/\D/g, '').length < 9 || !pending.budget_range) {
      return;
    }

    // Mark draft as handled so it only fires once, then show the payment
    // acceptance modal instead of submitting directly. Deferred past the
    // commit so the state updates never happen synchronously in an effect.
    draftHandled.current = true;
    const timer = setTimeout(() => {
      setPendingDraftInput({
        phone: pending.phone || '',
        preferred_zone: pending.preferred_zone || null,
        budget_range: pending.budget_range || '',
        gender: pending.gender || 'no_preference',
        room_type: pending.room_type || 'no_preference',
        furnishing: pending.furnishing || 'no_preference',
        stay_preference: pending.stay_preference || 'no_preference',
        move_in_date: pending.move_in_date || null,
        additional_requirements: pending.additional_requirements || null,
      });
      setShowPaymentModal(true);
      setPaymentAccepted(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [draft, isHome, hasCampus, submitting]);

  const canSubmit = useMemo(() => {
    return phone.replace(/\D/g, '').length >= 9 && !!budget && hasCampus;
  }, [phone, budget, hasCampus]);

  const phoneError =
    phone.replace(/\D/g, '').length >= 9 ? null : 'Enter a phone number with at least 9 digits.';
  const budgetError = budget ? null : 'Pick a monthly budget.';

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!canSubmit) {
      setAttempted(true);
      return;
    }
    setSubmitError(null);

    if (isHome) {
      // Guest (or cold session): save the draft and go to Google OAuth — the
      // payment modal will appear on the account page after login.
      await authClient.auth.getSession();
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (!user) {
        setSubmitting(true);
        sessionStorage.setItem(
          PENDING_REQUEST_KEY,
          JSON.stringify({
            phone,
            preferred_zone: preferredZone === '__none__' ? null : preferredZone,
            budget_range: budget,
            gender,
            room_type: roomType,
            furnishing,
            stay_preference: stayPreference,
            move_in_date: moveInDate || null,
            additional_requirements: requirements.trim() || null,
          }),
        );
        setSubmitting(false);
        await signInWithGoogle('/account');
        return;
      }
    }

    // Logged-in user (homepage or dashboard): show the payment acceptance modal.
    setPendingDraftInput(null);
    setShowPaymentModal(true);
    setPaymentAccepted(false);
  }, [
    canSubmit,
    submitting,
    isHome,
    authClient,
    phone,
    preferredZone,
    budget,
    gender,
    roomType,
    furnishing,
    stayPreference,
    moveInDate,
    requirements,
  ]);

  const handlePaymentModalClose = useCallback(() => {
    setShowPaymentModal(false);
    setPaymentAccepted(false);
  }, []);

  // Escape closes whichever dialog is open.
  const dialogOpen = showPaymentModal || !!editing;
  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showPaymentModal) handlePaymentModalClose();
      else setEditing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, showPaymentModal, handlePaymentModalClose]);

  const submitAfterPaymentAcceptance = useCallback(async () => {
    setShowPaymentModal(false);
    setSubmitting(true);

    // Use the pending draft input (auto-submit from homepage OAuth flow) or
    // build from the current form values (manual submit).
    const input = pendingDraftInput ?? {
      phone,
      preferred_zone: preferredZone === '__none__' ? null : preferredZone,
      budget_range: budget,
      gender,
      room_type: roomType,
      furnishing,
      stay_preference: stayPreference,
      move_in_date: moveInDate || null,
      additional_requirements: requirements.trim() || null,
    };

    const res = await createHostelRequestAction(input);
    setSubmitting(false);

    if (!res.success) {
      setSubmitError(res.error);
      toast.error(res.error);
      // If this was a draft auto-submit that failed due to campus/profile
      // issues, keep the draft so it can retry.
      if (pendingDraftInput && /campus|profile|account/i.test(res.error)) {
        draftHandled.current = false;
      }
      return;
    }

    setSubmitError(null);
    setAttempted(false);
    if (res.data) {
      setJustSubmitted(res.data);
      setRequests((prev) => [res.data as HostelRequest, ...prev]);
    }
    sessionStorage.removeItem(PENDING_REQUEST_KEY);
    setPendingDraftInput(null);
    setDraft(null);

    // Reset only the optional bits; keep phone/zone for a repeat request.
    setBudget('');
    setGender('no_preference');
    setRoomType('no_preference');
    setFurnishing('no_preference');
    setStayPreference('no_preference');
    setMoveInDate('');
    setRequirements('');

    toast.success('Request submitted. A Rumia manager will contact you.');
  }, [
    pendingDraftInput,
    phone,
    preferredZone,
    budget,
    gender,
    roomType,
    furnishing,
    stayPreference,
    moveInDate,
    requirements,
  ]);

  const handleCancel = useCallback(
    async (id: string) => {
      const res = await cancelMyHostelRequestAction(id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)),
      );
      toast.success('Request cancelled.');
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Remove this cancelled request from your dashboard?')) {
        return;
      }
      const res = await deleteMyHostelRequestAction(id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success('Request removed.');
    },
    [],
  );

  const openEdit = useCallback((r: HostelRequest) => {
    setEditing({
      id: r.id,
      phone: r.phone,
      preferred_zone: r.preferred_zone || '__none__',
      budget_range: r.budget_range,
      gender: r.gender,
      room_type: r.room_type,
      furnishing: r.furnishing,
      stay_preference: r.stay_preference || 'no_preference',
      move_in_date: r.move_in_date || '',
      additional_requirements: r.additional_requirements || '',
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing || savingEdit) return;
    if ((editing.phone || '').replace(/\D/g, '').length < 9 || !editing.budget_range) {
      toast.error('Add your phone number and pick a budget to save.');
      return;
    }
    setSavingEdit(true);
    const id = editing.id;
    const res = await updateMyHostelRequestAction(id, {
      phone: editing.phone,
      preferred_zone:
        editing.preferred_zone === '__none__' ? null : editing.preferred_zone,
      budget_range: editing.budget_range,
      gender: editing.gender,
      room_type: editing.room_type,
      furnishing: editing.furnishing,
      stay_preference: editing.stay_preference,
      move_in_date: editing.move_in_date || null,
      additional_requirements:
        editing.additional_requirements.trim() || null,
    });
    setSavingEdit(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }

    if (res.data) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...res.data } : r)),
      );
    }
    setEditing(null);
    toast.success('Request updated. A manager will see your changes.');
  }, [editing, savingEdit]);

  const chipClass = (selected: boolean) =>
    cn(
      'px-3.5 py-2 rounded-xl text-xs font-bold transition-all border text-center select-none',
      selected
        ? 'bg-ink text-white border-slate-900 shadow-sm'
        : 'bg-white text-slate-700 border-line hover:border-slate-300',
    );

  const fieldLabel = (label: string, required = false, htmlFor?: string, id?: string) => {
    const cls = 'block text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1.5';
    const mark = required && (
      <>
        <span aria-hidden className="text-rose-500 ml-0.5">*</span>
        <span className="sr-only"> (required)</span>
      </>
    );
    return htmlFor ? (
      <label htmlFor={htmlFor} className={cls}>
        {label}
        {mark}
      </label>
    ) : (
      <p id={id} className={cls}>
        {label}
        {mark}
      </p>
    );
  };

  const requestCard = (request: HostelRequest) => {
    const status = getHostelRequestStatus(request.status);
    return (
      <div
        key={request.id}
        className="rounded-2xl border border-line bg-white p-4 space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                request.status === 'cancelled'
                  ? 'bg-rose-50 text-rose-500'
                  : 'bg-emerald-50 text-primary',
              )}
            >
              {request.status === 'cancelled' ? (
                <X className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-ink">
                {getHostelRequestStatus(request.status).label}
              </p>
              <p className="text-[11px] text-ink-muted">
                {formatDate(request.created_at, 'd MMM yyyy')}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold',
              status.badgeClass,
            )}
          >
            {request.status === 'waiting' && <Clock className="h-3 w-3" />}
            {status.label}
          </span>
        </div>

        {/* What the user chose — shown like the manager inbox */}
        <div className="rounded-xl bg-subtle divide-y divide-slate-100 border border-slate-100 px-3.5 py-1 text-xs">
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-ink-muted shrink-0">Area</span>
            <span className="font-semibold text-ink text-right truncate">
              {request.preferred_zone || 'Any area'} • {campusName || 'campus'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-ink-muted shrink-0">Budget</span>
            <span className="font-semibold text-ink">
              {budgetLabel(request.budget_range)}/month
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-ink-muted shrink-0">Gender</span>
            <span className="font-semibold text-ink">
              {genderLabel(request.gender)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-ink-muted shrink-0">Room type</span>
            <span className="font-semibold text-ink">
              {roomTypeLabel(request.room_type)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-ink-muted shrink-0">Stay alone / sharing</span>
            <span className="font-semibold text-ink">
              {stayPreferenceLabel(request.stay_preference)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-ink-muted shrink-0">Furnishing</span>
            <span className="font-semibold text-ink">
              {furnishingLabel(request.furnishing)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-ink-muted shrink-0">Move-in</span>
            <span className="font-semibold text-ink">
              {request.move_in_date
                ? formatDate(request.move_in_date, 'd MMM yyyy')
                : 'Flexible'}
            </span>
          </div>
          {request.additional_requirements?.trim() && (
            <div className="flex items-start justify-between gap-4 py-1.5">
              <span className="text-ink-muted shrink-0">Requirements</span>
              <span className="font-semibold text-ink text-right">
                {request.additional_requirements}
              </span>
            </div>
          )}
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-ink-muted shrink-0">Service fee</span>
            <span className="font-bold text-ink tabular-nums">
              KSh {request.fee.toLocaleString()}
            </span>
          </div>
        </div>

        {(request.status === 'waiting' || request.status === 'contacted') && (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => openEdit(request)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors rounded-lg px-3 py-1.5"
            >
              <Pencil className="h-3 w-3" />
              Edit request
            </button>
            <button
              onClick={() => handleCancel(request.id)}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 transition-colors"
            >
              Cancel request
            </button>
          </div>
        )}

        {request.status === 'cancelled' && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-slate-500">
              You can remove this request to keep your dashboard tidy.
            </p>
            <button
              onClick={() => handleDelete(request.id)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors rounded-lg px-3 py-1.5"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="rounded-2xl border border-line bg-white p-4 sm:p-5 space-y-5"
    >
      {!hasCampus && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3">
          Set your campus in Account Settings to pick preferred areas and submit
          a request.
        </div>
      )}

      {/* Phone */}
      <div>
        {fieldLabel('Phone number', true, 'hr-phone')}
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            id="hr-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0712 345 678"
            aria-invalid={attempted && !!phoneError}
            aria-describedby={attempted && phoneError ? 'hr-phone-error' : undefined}
            className={cn(
              'w-full h-11 pl-10 pr-3 rounded-xl border text-sm focus:ring-2 outline-none',
              attempted && phoneError
                ? 'border-rose-400 focus:ring-rose-500 focus:border-rose-500'
                : 'border-slate-300 focus:ring-primary focus:border-primary',
            )}
          />
        </div>
        {attempted && phoneError && (
          <p id="hr-phone-error" role="alert" className="text-xs text-rose-600 mt-1">
            {phoneError}
          </p>
        )}
        {!hasCampus && (
          <p className="text-[11px] text-ink-muted mt-1">
            We use this to share your request with a campus manager.
          </p>
        )}
      </div>

      {/* Preferred zone */}
      <div>
        {fieldLabel('Preferred area / zone', false, 'hr-zone')}
        <div className="relative">
          <select
            id="hr-zone"
            value={preferredZone}
            onChange={(e) => setPreferredZone(e.target.value)}
            disabled={!hasCampus}
            className="w-full h-11 px-3 pr-9 rounded-xl border border-slate-300 text-sm bg-white appearance-none focus:ring-2 focus:ring-primary focus:border-primary outline-none disabled:bg-subtle disabled:text-slate-500"
          >
            <option value="__none__">
              {zones.length > 0 ? 'Any area / no preference' : 'Any area'}
            </option>
            {zones.map((z) => (
              <option key={z.id} value={z.name}>
                {z.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        </div>
        {zones.length === 0 && hasCampus && (
          <p className="text-[11px] text-ink-muted mt-1">
            No areas configured yet. We&apos;ll cover the whole campus.
          </p>
        )}
      </div>

      {/* Budget */}
      <div>
        {fieldLabel('Monthly budget', true, undefined, 'hr-budget-label')}
        <div
          role="group"
          aria-labelledby="hr-budget-label"
          aria-describedby={attempted && budgetError ? 'hr-budget-error' : undefined}
          className="grid grid-cols-2 sm:grid-cols-3 gap-2"
        >
          {BUDGET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setBudget(option.value)}
              aria-pressed={budget === option.value}
              className={chipClass(budget === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {attempted && budgetError && (
          <p id="hr-budget-error" role="alert" className="text-xs text-rose-600 mt-1">
            {budgetError}
          </p>
        )}
      </div>

      {/* Gender */}
      <div>
        {fieldLabel('Gender')}
        <div className="grid grid-cols-3 gap-2">
          {GENDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setGender(option.value as HostelRequestGender)}
              aria-pressed={gender === option.value}
              className={chipClass(gender === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Room type */}
      <div>
        {fieldLabel('Room type')}
        <div className="grid grid-cols-4 gap-2">
          {ROOM_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRoomType(option.value as HostelRequestRoomType)}
              aria-pressed={roomType === option.value}
              className={chipClass(roomType === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-muted mt-1">
          Single room is a room without self-contained facilities; bedsitter is
          self-contained; one bedroom is a separate bedroom.
        </p>
      </div>

      {/* Stay alone or sharing */}
      <div>
        {fieldLabel('Stay alone or sharing')}
        <div className="grid grid-cols-3 gap-2">
          {STAY_PREFERENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setStayPreference(option.value as HostelRequestStayPreference)
              }
              aria-pressed={stayPreference === option.value}
              className={chipClass(stayPreference === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-muted mt-1">
          Let the manager know if you want the room to yourself or if you&apos;re
          happy sharing a room with a roommate to cost-share.
        </p>
      </div>

      {/* Furnishing */}
      <div>
        {fieldLabel('Furnishing')}
        <div className="grid grid-cols-3 gap-2">
          {FURNISHING_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setFurnishing(option.value as HostelRequestFurnishing)
              }
              aria-pressed={furnishing === option.value}
              className={chipClass(furnishing === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Move-in date */}
      <div>
        {fieldLabel('Move-in date', false, 'hr-move-in')}
        <input
          id="hr-move-in"
          type="date"
          value={moveInDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={(e) => setMoveInDate(e.target.value)}
          className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
      </div>

      {/* Additional requirements */}
      <div>
        {fieldLabel('Important requirements', false, 'hr-requirements')}
        <textarea
          id="hr-requirements"
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder="Anything else you need? e.g. Hot water, parking, wifi…"
          rows={2}
          className="w-full rounded-xl border border-slate-300 text-sm p-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
        />
      </div>

      {/* CTA */}
      <div className="pt-1 space-y-2.5">
        {submitError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {submitError}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-ink hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting ? 'Submitting…' : isHome ? 'Find My Hostel' : 'Submit Request'}
        </button>
        {isHome && (
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Your request is saved to your dashboard the moment you submit. If you
            are not signed in we&apos;ll quickly confirm your account first.
          </p>
        )}
      </div>
    </form>
  );

  // Homepage variant: words on the left, form on the right.
  if (isHome) {
    return (
      <>
      <section className="bg-raised border-y border-line py-10 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* Left column: copy */}
            <div className="lg:pt-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-primary text-xs font-bold mb-5">
                <CompassIcon />
                Hostel Finding Service
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.1]">
                Let Rumia Find For You a Home
              </h2>
            </div>

            {/* Right column: the form */}
            <div className="w-full">
              {justSubmitted && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 space-y-2 mb-5">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <p className="text-sm font-bold text-emerald-900">
                      Request Submitted · Waiting
                    </p>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Your hostel request has been received. A Rumia manager will
                    review your requirements and contact you to help find a
                    suitable hostel.
                  </p>
                </div>
              )}
              {form}
            </div>
          </div>
        </div>
      </section>

      {/* Payment acceptance modal (only renders when logged-in user submits) */}
      {mounted && createPortal(
        showPaymentModal && (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Accept payment"
          >
            <div
              className="absolute inset-0 bg-slate-950/50"
              onClick={handlePaymentModalClose}
            />
            <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <CreditCard className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink">
                      Accept Service Fee
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      You need to accept the fee before submitting
                    </p>
                  </div>
                </div>
                <button
                  onClick={handlePaymentModalClose}
                  className="p-2 -mt-1 -mr-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-subtle rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted">Service fee</span>
                  <span className="text-sm font-bold text-ink tabular-nums">
                    KSh {(campusFee ?? HOSTEL_REQUEST_FEE).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-sm font-semibold text-ink">
                    Amount to pay now (50%)
                  </span>
                  <span className="text-lg font-extrabold text-ink tabular-nums">
                    KSh {Math.ceil((campusFee ?? HOSTEL_REQUEST_FEE) / 2).toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-xs text-ink-muted leading-relaxed">
                A Rumia manager will contact you on WhatsApp with payment
                details after you submit.
              </p>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentAccepted}
                  onChange={(e) => setPaymentAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-ink focus:ring-primary"
                />
                <span className="text-sm text-slate-700 leading-snug">
                  I agree to pay half of the service fee (KSh{' '}
                  {Math.ceil((campusFee ?? HOSTEL_REQUEST_FEE) / 2).toLocaleString()}) to confirm this
                  request.
                </span>
              </label>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handlePaymentModalClose}
                  className="flex-1 h-11 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-subtle transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAfterPaymentAcceptance}
                  disabled={!paymentAccepted || submitting}
                  className="flex-1 h-11 rounded-xl bg-ink hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {submitting ? 'Submitting…' : 'Accept & Submit'}
                </button>
              </div>
            </div>
          </div>
        ),
        document.body,
      )}
      </>
    );
  }

  return (
    <section className="pt-4 border-t border-line space-y-6">
      {/* Section header */}
      <div>
        <h3 className="text-base sm:text-lg font-bold text-ink">
          Find Me a Hostel
        </h3>
        <p className="text-xs text-ink-muted mt-0.5">
          Tell us what you&apos;re looking for and Rumia will find it for you. A
          manager reviews your request and contacts you on WhatsApp.
        </p>
      </div>

      {/* Success confirmation */}
      {justSubmitted && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm font-bold text-emerald-900">
              Request Submitted · Waiting
            </p>
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Your hostel request has been received. A Rumia manager will review
            your requirements and contact you to help find a suitable hostel.
          </p>
        </div>
      )}

      {/* Form */}
      {justSubmitted ? null : form}

      {/* Existing requests */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-ink">Your Requests</h4>
          {!loadingRequests && requests.length > 0 && (
            <span className="text-[11px] font-bold text-slate-500">
              {requests.length} {requests.length === 1 ? 'request' : 'requests'}
            </span>
          )}
        </div>

        {loadingRequests ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-subtle p-6 text-center">
            <p className="text-xs text-ink-muted">
              No requests yet. Submit the form above and we&apos;ll take it
              from here.
            </p>
          </div>
        ) : (
          requests.map(requestCard)
        )}
      </div>

      {/* Edit request modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit request"
            className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto p-5"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-ink">
                  Edit Request
                </h4>
                <p className="text-xs text-ink-muted mt-0.5">
                  Update your requirements — a manager will see the change
                  instantly.
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-ink-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                {fieldLabel('Phone number', true)}
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={editing.phone}
                    onChange={(e) =>
                      setEditing({ ...editing, phone: e.target.value })
                    }
                    placeholder="e.g. 0712 345 678"
                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div>
                {fieldLabel('Preferred area / zone')}
                <div className="relative">
                  <select
                    value={editing.preferred_zone}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        preferred_zone: e.target.value,
                      })
                    }
                    className="w-full h-11 px-3 pr-9 rounded-xl border border-slate-300 text-sm bg-white appearance-none focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  >
                    <option value="__none__">
                      {zones.length > 0 ? 'Any area / no preference' : 'Any area'}
                    </option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.name}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div>
                {fieldLabel('Monthly budget', true)}
                <div className="grid grid-cols-2 gap-2">
                  {BUDGET_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          budget_range: option.value,
                        })
                      }
                      aria-pressed={editing.budget_range === option.value}
              className={chipClass(
                        editing.budget_range === option.value,
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {fieldLabel('Gender')}
                <div className="grid grid-cols-3 gap-2">
                  {GENDER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          gender: option.value as HostelRequestGender,
                        })
                      }
                      aria-pressed={editing.gender === option.value}
              className={chipClass(editing.gender === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {fieldLabel('Room type')}
                <div className="grid grid-cols-4 gap-2">
                  {ROOM_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          room_type: option.value as HostelRequestRoomType,
                        })
                      }
                      aria-pressed={editing.room_type === option.value}
              className={chipClass(editing.room_type === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {fieldLabel('Stay alone or sharing')}
                <div className="grid grid-cols-3 gap-2">
                  {STAY_PREFERENCE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          stay_preference:
                            option.value as HostelRequestStayPreference,
                        })
                      }
                      aria-pressed={editing.stay_preference === option.value}
              className={chipClass(
                        editing.stay_preference === option.value,
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {fieldLabel('Furnishing')}
                <div className="grid grid-cols-3 gap-2">
                  {FURNISHING_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          furnishing:
                            option.value as HostelRequestFurnishing,
                        })
                      }
                      aria-pressed={editing.furnishing === option.value}
              className={chipClass(editing.furnishing === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {fieldLabel('Move-in date', false, 'hr-edit-move-in')}
                <input
                  id="hr-edit-move-in"
                  type="date"
                  value={editing.move_in_date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) =>
                    setEditing({ ...editing, move_in_date: e.target.value })
                  }
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                {fieldLabel('Important requirements', false)}
                <textarea
                  value={editing.additional_requirements}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      additional_requirements: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 text-sm p-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-5">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 h-11 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 h-11 rounded-xl bg-ink hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment acceptance modal */}
      {mounted && createPortal(
        showPaymentModal && (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Accept payment"
          >
            <div
              className="absolute inset-0 bg-slate-950/50"
              onClick={handlePaymentModalClose}
            />
            <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <CreditCard className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink">
                      Accept Service Fee
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      You need to accept the fee before submitting
                    </p>
                  </div>
                </div>
                <button
                  onClick={handlePaymentModalClose}
                  className="p-2 -mt-1 -mr-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-subtle rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted">Service fee</span>
                  <span className="text-sm font-bold text-ink tabular-nums">
                    KSh {(campusFee ?? HOSTEL_REQUEST_FEE).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-sm font-semibold text-ink">
                    Amount to pay now (50%)
                  </span>
                  <span className="text-lg font-extrabold text-ink tabular-nums">
                    KSh {Math.ceil((campusFee ?? HOSTEL_REQUEST_FEE) / 2).toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-xs text-ink-muted leading-relaxed">
                A Rumia manager will contact you on WhatsApp with payment
                details after you submit.
              </p>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentAccepted}
                  onChange={(e) => setPaymentAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-ink focus:ring-primary"
                />
                <span className="text-sm text-slate-700 leading-snug">
                  I agree to pay half of the service fee (KSh{' '}
                  {Math.ceil((campusFee ?? HOSTEL_REQUEST_FEE) / 2).toLocaleString()}) to confirm this
                  request.
                </span>
              </label>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handlePaymentModalClose}
                  className="flex-1 h-11 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-subtle transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAfterPaymentAcceptance}
                  disabled={!paymentAccepted || submitting}
                  className="flex-1 h-11 rounded-xl bg-ink hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {submitting ? 'Submitting…' : 'Accept & Submit'}
                </button>
              </div>
            </div>
          </div>
        ),
        document.body,
      )}
    </section>
  );
}

function CompassIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265L16.24 7.76Z" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}