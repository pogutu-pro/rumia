'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { signInWithGoogle } from '@/lib/supabase/auth';
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
  getHostelRequestStatus,
  budgetLabel,
  genderLabel,
  roomTypeLabel,
  furnishingLabel,
} from '@/lib/constants/hostel-requests';
import type {
  HostelRequest,
  HostelRequestGender,
  HostelRequestRoomType,
  HostelRequestFurnishing,
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
}

interface EditDraft {
  id: string;
  phone: string;
  preferred_zone: string;
  budget_range: string;
  gender: HostelRequestGender;
  room_type: HostelRequestRoomType;
  furnishing: HostelRequestFurnishing;
  move_in_date: string;
  additional_requirements: string;
}

export function FindMeAHostel({
  variant = 'dashboard',
  studentPhone = null,
  campusId = null,
  campusName = null,
}: FindMeAHostelProps) {
  const isHome = variant === 'home';
  const [supabase] = useState(() => createClient());

  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [requests, setRequests] = useState<HostelRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<HostelRequest | null>(null);

  // Pending draft left by the homepage guest flow: after Google sign-in the user
  // lands on the account page and this request is submitted automatically.
  const [draft, setDraft] = useState<CreateHostelRequestInput | null>(null);
  const draftHandled = useRef(false);

  // Form state
  const [phone, setPhone] = useState<string>(studentPhone || '');
  const [preferredZone, setPreferredZone] = useState<string>('__none__');
  const [budget, setBudget] = useState<string>('');
  const [gender, setGender] = useState<HostelRequestGender>('no_preference');
  const [roomType, setRoomType] = useState<HostelRequestRoomType>('no_preference');
  const [furnishing, setFurnishing] = useState<HostelRequestFurnishing>('no_preference');
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
      const [zonesRes, reqs] = await Promise.all([
        hasCampus
          ? supabase
              .from('campus_zones')
              .select('id, name')
              .eq('campus_id', campusId!)
              .order('name', { ascending: true })
          : Promise.resolve({ data: null as unknown }),
        isHome
          ? Promise.resolve([] as HostelRequest[])
          : getMyHostelRequestsAction(),
      ]);
      if (cancelled) return;

      const zoneData = zonesRes.data as Array<{ id: string; name: string }> | null;
      if (zoneData) setZones(zoneData);
      setRequests(reqs);

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
  }, [hasCampus, campusId, supabase, isHome, studentPhone]);

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

    const input: CreateHostelRequestInput = {
      phone: pending.phone || '',
      preferred_zone: pending.preferred_zone || null,
      budget_range: pending.budget_range || '',
      gender: pending.gender || 'no_preference',
      room_type: pending.room_type || 'no_preference',
      furnishing: pending.furnishing || 'no_preference',
      move_in_date: pending.move_in_date || null,
      additional_requirements: pending.additional_requirements || null,
    };

    let cancelled = false;
    async function run() {
      draftHandled.current = true;
      setSubmitting(true);
      const res = await createHostelRequestAction(input);
      if (cancelled) return;
      setSubmitting(false);

      if (!res.success) {
        // A campus/profile error means the user still needs to complete their
        // account — keep the draft so it submits right after. Anything else is
        // a data problem; drop it so the user edits and resubmits normally.
        toast.error(res.error);
        const keepDraft =
          /campus|profile|account/i.test(res.error) && !hasCampus;
        if (keepDraft) {
          // Allow the draft to retry once the profile is completed.
          draftHandled.current = false;
        } else {
          sessionStorage.removeItem(PENDING_REQUEST_KEY);
          setDraft(null);
        }
        return;
      }

      if (res.data) {
        setJustSubmitted(res.data);
        setRequests((prev) => [res.data as HostelRequest, ...prev]);
      }
      sessionStorage.removeItem(PENDING_REQUEST_KEY);
      setDraft(null);
      // Reset only the optional bits; keep phone/zone for a repeat request.
      setBudget('');
      setGender('no_preference');
      setRoomType('no_preference');
      setFurnishing('no_preference');
      setMoveInDate('');
      setRequirements('');
      toast.success('Request submitted. A Rumia manager will contact you.');
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [draft, isHome, hasCampus, submitting]);

  const canSubmit = useMemo(() => {
    return phone.replace(/\D/g, '').length >= 9 && !!budget && hasCampus;
  }, [phone, budget, hasCampus]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    if (isHome) {
      // Guest (or cold session): stash the draft, then go straight to Google's
      // account chooser — never the login page. On return they land on the
      // account page where the draft auto-submits.
      await supabase.auth.getSession();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        sessionStorage.setItem(
          PENDING_REQUEST_KEY,
          JSON.stringify({
            phone,
            preferred_zone: preferredZone === '__none__' ? null : preferredZone,
            budget_range: budget,
            gender,
            room_type: roomType,
            furnishing,
            move_in_date: moveInDate || null,
            additional_requirements: requirements.trim() || null,
          }),
        );
        setSubmitting(false);
        await signInWithGoogle('/account');
        return;
      }
    }

    const zone = preferredZone === '__none__' ? null : preferredZone;
    const res = await createHostelRequestAction({
      phone,
      preferred_zone: zone,
      budget_range: budget,
      gender,
      room_type: roomType,
      furnishing,
      move_in_date: moveInDate || null,
      additional_requirements: requirements.trim() || null,
    });
    setSubmitting(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }

    if (res.data) {
      setJustSubmitted(res.data);
      setRequests((prev) => [res.data as HostelRequest, ...prev]);
    }
    sessionStorage.removeItem(PENDING_REQUEST_KEY);
    setDraft(null);

    // Reset only the optional bits; keep phone/zone for a repeat request.
    setBudget('');
    setGender('no_preference');
    setRoomType('no_preference');
    setFurnishing('no_preference');
    setMoveInDate('');
    setRequirements('');

    toast.success('Request submitted. A Rumia manager will contact you.');
  }, [
    canSubmit,
    submitting,
    isHome,
    supabase,
    phone,
    preferredZone,
    budget,
    gender,
    roomType,
    furnishing,
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
        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300',
    );

  const fieldLabel = (label: string, required = false) => (
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </p>
  );

  const requestCard = (request: HostelRequest) => {
    const status = getHostelRequestStatus(request.status);
    return (
      <div
        key={request.id}
        className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                request.status === 'cancelled'
                  ? 'bg-rose-50 text-rose-500'
                  : 'bg-emerald-50 text-emerald-600',
              )}
            >
              {request.status === 'cancelled' ? (
                <X className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                {getHostelRequestStatus(request.status).label}
              </p>
              <p className="text-[11px] text-slate-500">
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
        <div className="rounded-xl bg-slate-50/70 divide-y divide-slate-100 border border-slate-100 px-3.5 py-1 text-xs">
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-slate-500 shrink-0">Area</span>
            <span className="font-semibold text-slate-900 text-right truncate">
              {request.preferred_zone || 'Any area'} • {campusName || 'campus'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-slate-500 shrink-0">Budget</span>
            <span className="font-semibold text-slate-900">
              {budgetLabel(request.budget_range)}/month
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-slate-500 shrink-0">Gender</span>
            <span className="font-semibold text-slate-900">
              {genderLabel(request.gender)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-slate-500 shrink-0">Room type</span>
            <span className="font-semibold text-slate-900">
              {roomTypeLabel(request.room_type)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-slate-500 shrink-0">Furnishing</span>
            <span className="font-semibold text-slate-900">
              {furnishingLabel(request.furnishing)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-slate-500 shrink-0">Move-in</span>
            <span className="font-semibold text-slate-900">
              {request.move_in_date
                ? formatDate(request.move_in_date, 'd MMM yyyy')
                : 'Flexible'}
            </span>
          </div>
          {request.additional_requirements?.trim() && (
            <div className="flex items-start justify-between gap-4 py-1.5">
              <span className="text-slate-500 shrink-0">Requirements</span>
              <span className="font-semibold text-slate-900 text-right">
                {request.additional_requirements}
              </span>
            </div>
          )}
          <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-slate-500 shrink-0">Service fee</span>
            <span className="font-bold text-slate-900 tabular-nums">
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
            <p className="text-[11px] text-slate-400">
              You can remove this request to keep your dashboard tidy.
            </p>
            <button
              onClick={() => handleDelete(request.id)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors rounded-lg px-3 py-1.5"
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
      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 space-y-5"
    >
      {!hasCampus && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3">
          Set your campus in Account Settings to pick preferred areas and submit
          a request.
        </div>
      )}

      {/* Phone */}
      <div>
        {fieldLabel('Phone number', true)}
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0712 345 678"
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
            required
          />
        </div>
        {!hasCampus && (
          <p className="text-[11px] text-slate-400 mt-1">
            We use this to share your request with a campus manager.
          </p>
        )}
      </div>

      {/* Preferred zone */}
      <div>
        {fieldLabel('Preferred area / zone')}
        <div className="relative">
          <select
            value={preferredZone}
            onChange={(e) => setPreferredZone(e.target.value)}
            disabled={!hasCampus}
            className="w-full h-11 px-3 pr-9 rounded-xl border border-slate-300 text-sm bg-white appearance-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none disabled:bg-slate-50 disabled:text-slate-400"
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
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
        {zones.length === 0 && hasCampus && (
          <p className="text-[11px] text-slate-400 mt-1">
            No areas configured yet. We&apos;ll cover the whole campus.
          </p>
        )}
      </div>

      {/* Budget */}
      <div>
        {fieldLabel('Monthly budget', true)}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BUDGET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setBudget(option.value)}
              className={chipClass(budget === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
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
              className={chipClass(roomType === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
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
              className={chipClass(furnishing === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Move-in date */}
      <div>
        {fieldLabel('Move-in date')}
        <input
          type="date"
          value={moveInDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={(e) => setMoveInDate(e.target.value)}
          className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
        />
      </div>

      {/* Additional requirements */}
      <div>
        {fieldLabel('Important requirements', false)}
        <textarea
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder="Anything else you need? e.g. Hot water, parking, wifi…"
          rows={2}
          className="w-full rounded-xl border border-slate-300 text-sm p-3 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none resize-none"
        />
      </div>

      {/* CTA */}
      <div className="pt-1 space-y-2.5">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting ? 'Submitting…' : isHome ? 'Find My Hostel' : 'Submit Request'}
        </button>
        {!canSubmit && (
          <p className="text-[11px] text-slate-400 text-center">
            Add your phone number and pick a budget to submit.
          </p>
        )}
        {isHome && (
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
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
      <section className="bg-white border-y border-slate-200/60 py-10 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* Left column: copy */}
            <div className="lg:pt-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-bold mb-5">
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
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
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
    );
  }

  return (
    <section className="pt-4 border-t border-slate-200/60 space-y-6">
      {/* Section header */}
      <div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900">
          Find Me a Hostel
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Tell us what you&apos;re looking for and Rumia will find it for you. A
          manager reviews your request and contacts you on WhatsApp.
        </p>
      </div>

      {/* Success confirmation */}
      {justSubmitted && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
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
          <h4 className="text-sm font-bold text-slate-900">Your Requests</h4>
          {!loadingRequests && requests.length > 0 && (
            <span className="text-[11px] font-bold text-slate-400">
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
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <p className="text-xs text-slate-500">
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
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Edit Request
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your requirements — a manager will see the change
                  instantly.
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                {fieldLabel('Phone number', true)}
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={editing.phone}
                    onChange={(e) =>
                      setEditing({ ...editing, phone: e.target.value })
                    }
                    placeholder="e.g. 0712 345 678"
                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
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
                    className="w-full h-11 px-3 pr-9 rounded-xl border border-slate-300 text-sm bg-white appearance-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
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
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
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
                      className={chipClass(editing.room_type === option.value)}
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
                      className={chipClass(editing.furnishing === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {fieldLabel('Move-in date')}
                <input
                  type="date"
                  value={editing.move_in_date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) =>
                    setEditing({ ...editing, move_in_date: e.target.value })
                  }
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
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
                  className="w-full rounded-xl border border-slate-300 text-sm p-3 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-5">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 h-11 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
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