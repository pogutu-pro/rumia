'use client';

import { useState, useMemo, useCallback, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarCheck,
  Check,
  Clock,
  User,
  Phone,
  MapPin,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { useIsMobile } from '@/hooks/use-media-query';
import { formatTourPrice } from '@/lib/constants/tour-pricing';
import { signInWithGoogle, getSession } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/client';
import { isValidKenyanPhone } from '@/lib/utils/phone';
import type { TourTimeWindow, TourBooking } from '@/types';
import posthog from 'posthog-js';

interface BookTourFormProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string | number;
  listingTitle: string;
  listingZone: string | null;
  agentId: string | number;
  /**
   * Zone tour price for the listing's zone, as configured by a campus manager
   * in campus_zones. When it is not provided the zone has no configured price,
   * so the form shows "Pricing unavailable" and blocks submission.
   */
  zoneFullSearchPrice?: number;
  /** UUID of the campus this zone belongs to (booked from a zone picker). */
  campusId?: string;
  /** Display name of the campus, e.g. "Dedan Kimathi University". */
  campusName?: string;
}

type FormStep = 'form' | 'confirmation';

const TIME_OPTIONS: Array<{
  value: TourTimeWindow;
  label: string;
  icon: string;
}> = [
  { value: 'morning', label: 'Morning', icon: '' },
  { value: 'afternoon', label: 'Afternoon', icon: '' },
  { value: 'evening', label: 'Evening', icon: '' },
];

function getDefaultDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// ── Animation Variants ──────────────────────────────────────

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const desktopModalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      damping: 28,
      stiffness: 340,
      mass: 0.9,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 8,
    transition: { duration: 0.15, ease: 'easeIn' as const },
  },
};

const mobileSheetVariants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: {
      type: 'spring' as const,
      damping: 32,
      stiffness: 320,
      mass: 1,
    },
  },
  exit: {
    y: '100%',
    transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const },
  },
};

// ── Main Component ──────────────────────────────────────────

export function BookTourForm({
  isOpen,
  onClose,
  listingId,
  listingTitle,
  listingZone,
  agentId,
  zoneFullSearchPrice,
  campusId,
  campusName,
}: BookTourFormProps) {
  const isMobile = useIsMobile();
  // Returns true only after hydration, so the portal/sheet never renders on SSR.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [step, setStep] = useState<FormStep>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [booking, setBooking] = useState<TourBooking | null>(null);

  // Form state
  const [preferredDate, setPreferredDate] = useState(getDefaultDate);
  const [preferredTime, setPreferredTime] = useState<TourTimeWindow>('morning');
  const [studentName, setStudentName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneAttempts, setPhoneAttempts] = useState(0);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const zone = listingZone;
  const fromListing = !!listingId;

  const price = useMemo(
    () => zoneFullSearchPrice ?? null,
    [zoneFullSearchPrice],
  );

  // Auto-fill from profile if user is logged in
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadProfile() {
      try {
        const { session } = await getSession();
        if (!session?.user || cancelled) return;

        setIsLoggedIn(true);
        setLinkedUserId(session.user.id);

        const supabase = createClient();
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', session.user.id)
          .single();

        if (!cancelled && profile) {
          if (profile.full_name) setStudentName(profile.full_name);
          if (profile.phone) setPhone(profile.phone);
        }
      } catch {
        // Not logged in, continue as guest
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const resetForm = useCallback(() => {
    setStep('form');
    setBooking(null);
    setPreferredDate(getDefaultDate());
    setPreferredTime('morning');
    setStudentName('');
    setPhone('');
    setPhoneError('');
    setPhoneAttempts(0);
    setLinkedUserId(null);
    setIsLoggedIn(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!phone.trim() || !isValidKenyanPhone(phone)) {
      const attempts = phoneAttempts + 1;
      setPhoneAttempts(attempts);
      if (attempts >= 2) {
        toast.error(
          "That number still doesn't look right. Please try again — use a valid Kenyan number like 0712 345 678.",
        );
      } else {
        toast.error(
          "That doesn't look like a valid Kenyan number. Please try again (e.g. 0712 345 678).",
        );
      }
      return;
    }
    if (!zone) {
      toast.error('Zone information unavailable');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tour-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: studentName.trim(),
          phone: phone.trim(),
          listing_id: String(listingId),
          zone,
          tour_type: 'full_search',
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          agent_id: agentId,
          linked_user_id: linkedUserId,
          from_listing: fromListing,
          campus_id: campusId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create booking');
      }

      setBooking(data.booking);
      setStep('confirmation');
      posthog.capture('tour_booked', {
        listing_id: String(listingId),
        tour_type: 'full_search',
        zone,
        preferred_time: preferredTime,
        from_listing: fromListing,
      });
      toast.success('Tour booked successfully!');
    } catch (error) {
      posthog.captureException(error);
      console.error('Booking error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to book tour. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const { error } = await signInWithGoogle(
        `/hostels/${encodeURIComponent(listingZone || '')}/booked`,
      );
      if (error) {
        console.error('Google sign-in error:', error);
        toast.error('Failed to sign in with Google');
      }
    } catch {
      toast.error('Failed to sign in with Google');
    }
  }, [listingZone]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-label="Book a tour"
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={handleClose}
          />

          {isMobile ? (
            /* ── Mobile Bottom Sheet ── */
            <motion.div
              className={cn(
                'absolute inset-x-0 bottom-0',
                'bg-white rounded-t-[24px]',
                'flex flex-col',
                'max-h-[92vh] overflow-y-auto',
                'shadow-[0_-4px_30px_rgba(0,0,0,0.12)]',
              )}
              variants={mobileSheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex justify-center pt-3 pb-1 px-6">
                <div className="w-9 h-[3px] bg-gray-300 rounded-full" />
              </div>
              <div className="px-5 pb-6 pt-2">
                {step === 'form' ? (
                  <FormContent
                    preferredDate={preferredDate}
                    setPreferredDate={setPreferredDate}
                    preferredTime={preferredTime}
                    setPreferredTime={setPreferredTime}
                    studentName={studentName}
                    setStudentName={setStudentName}
                    phone={phone}
                    setPhone={setPhone}
                    phoneError={phoneError}
                    setPhoneError={setPhoneError}
                    price={price}
                    zone={zone}
                    listingTitle={listingTitle}
                    campusName={campusName}
                    isSubmitting={isSubmitting}
                    isLoggedIn={isLoggedIn}
                    onSubmit={handleSubmit}
                    onClose={handleClose}
                  />
                ) : (
                  <ConfirmationContent
                    booking={booking!}
                    price={price}
                    isLoggedIn={isLoggedIn}
                    onGoogleSignIn={handleGoogleSignIn}
                    onClose={handleClose}
                  />
                )}
              </div>
            </motion.div>
          ) : (
            /* ── Desktop Modal ── */
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                className={cn(
                  'w-full max-w-[520px]',
                  'bg-white rounded-[20px]',
                  'shadow-[0_8px_40px_rgba(0,0,0,0.15)]',
                  'max-h-[90vh] overflow-y-auto',
                  'pointer-events-auto',
                )}
                variants={desktopModalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="p-6">
                  {step === 'form' ? (
                    <FormContent
                      preferredDate={preferredDate}
                      setPreferredDate={setPreferredDate}
                      preferredTime={preferredTime}
                      setPreferredTime={setPreferredTime}
                      studentName={studentName}
                      setStudentName={setStudentName}
                      phone={phone}
                      setPhone={setPhone}
                      phoneError={phoneError}
                      setPhoneError={setPhoneError}
                      price={price}
                      zone={zone}
                      listingTitle={listingTitle}
                      campusName={campusName}
                      isSubmitting={isSubmitting}
                      isLoggedIn={isLoggedIn}
                      onSubmit={handleSubmit}
                      onClose={handleClose}
                    />
                  ) : (
                    <ConfirmationContent
                      booking={booking!}
                      price={price}
                      isLoggedIn={isLoggedIn}
                      onGoogleSignIn={handleGoogleSignIn}
                      onClose={handleClose}
                    />
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ── Form Content ────────────────────────────────────────────

interface FormContentProps {
  preferredDate: string;
  setPreferredDate: (v: string) => void;
  preferredTime: TourTimeWindow;
  setPreferredTime: (v: TourTimeWindow) => void;
  studentName: string;
  setStudentName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  phoneError: string;
  setPhoneError: (v: string) => void;
  price: number | null;
  zone: string | null;
  listingTitle: string;
  campusName?: string;
  isSubmitting: boolean;
  isLoggedIn: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

function FormContent({
  preferredDate,
  setPreferredDate,
  preferredTime,
  setPreferredTime,
  studentName,
  setStudentName,
  phone,
  setPhone,
  phoneError,
  setPhoneError,
  price,
  zone,
  listingTitle,
  campusName,
  isSubmitting,
  isLoggedIn,
  onSubmit,
  onClose,
}: FormContentProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Book a Tour</h2>
          <p className="text-xs text-gray-500">
            {listingTitle
              ? `Near ${listingTitle}`
              : 'Reach your hostel without the guessing'}
          </p>
        </div>
      </div>

      {/* Why Tour Early */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold text-amber-900 mb-1">
          Don&apos;t waste your first choice
        </p>
        <p className="text-xs text-amber-700 leading-relaxed">
          Don&apos;t waste time getting lost, asking random people, or returning
          another day because the caretaker isn&apos;t available. Rumia knows
          the hostels, guides you there, and ensures you&apos;re expected.
        </p>
      </div>

      {/* Why There's a Fee */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-5">
        <p className="text-sm font-semibold text-emerald-900 mb-1">
          How the tour fee works
        </p>
        <p className="text-xs text-emerald-700 leading-relaxed">
          The fee covers a verified agent who sets aside dedicated time to walk
          you through the room, answer your questions, and show you the actual
          space. You pay the agent directly when you arrive. No online payment
          required.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Tour Type */}
        <div>
          <Label className="text-sm font-semibold text-gray-700 mb-3 block">
            Zone tour
          </Label>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {campusName ? `${campusName} · ${zone}` : zone}
                </p>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Per zone · any hostels in the area
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {listingTitle
                ? `You'll be guided through ${listingTitle} and other hostels in ${zone}. `
                : `A verified agent takes you around several hostels in ${zone}. `}
              The fee covers the whole zone, not a single hostel.
            </p>
          </div>
        </div>

        {/* Preferred Date */}
        <div className="space-y-2">
          <Label
            htmlFor="tour-date"
            className="text-sm font-semibold text-gray-700"
          >
            Preferred date
          </Label>
          <Input
            id="tour-date"
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="h-11 border-gray-300 focus:border-gray-500"
            required
          />
        </div>

        {/* Preferred Time */}
        <div>
          <Label className="text-sm font-semibold text-gray-700 mb-3 block">
            Preferred time
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreferredTime(option.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200',
                  preferredTime === option.value
                    ? 'border-slate-900 bg-slate-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <Clock
                  className={cn(
                    'h-4 w-4',
                    preferredTime === option.value
                      ? 'text-slate-900'
                      : 'text-gray-400',
                  )}
                />
                <span
                  className={cn(
                    'text-xs font-semibold',
                    preferredTime === option.value
                      ? 'text-slate-900'
                      : 'text-gray-600',
                  )}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label
            htmlFor="tour-name"
            className="text-sm font-semibold text-gray-700"
          >
            Your name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="tour-name"
              type="text"
              placeholder="e.g. John Kamau"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="h-11 pl-10 border-gray-300 focus:border-gray-500"
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label
            htmlFor="tour-phone"
            className="text-sm font-semibold text-gray-700"
          >
            Phone number
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="tour-phone"
              type="tel"
              placeholder="e.g. 0712 345 678"
              value={phone}
              onChange={(e) => {
                const val = e.target.value;
                setPhone(val);
                if (val.trim().length >= 9) {
                  setPhoneError(
                    isValidKenyanPhone(val)
                      ? ''
                      : 'Please enter a valid Kenyan number (07xx or 01xx)',
                  );
                } else {
                  setPhoneError('');
                }
              }}
              className={cn(
                'h-11 pl-10',
                phoneError
                  ? 'border-rose-400 focus-visible:ring-rose-400'
                  : 'border-gray-300 focus:border-gray-500',
              )}
              required
            />
          </div>
          {phoneError && (
            <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {phoneError}
            </p>
          )}
          <p className="text-[10px] text-gray-400 font-medium">
            {isLoggedIn
              ? 'From your account profile'
              : 'Used to match this booking if you create an account later'}
          </p>
        </div>

        {/* Price Display */}
        {price !== null && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tour fee
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Zone tour · {zone}
              </p>
            </div>
            <p className="text-xl font-black text-slate-900">
              {formatTourPrice(price)}
            </p>
          </div>
        )}

        {price === null && zone && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800">
              Pricing unavailable for this area. Please contact the agent
              directly.
            </p>
          </div>
        )}

        {/* Submit */}
        <div>
          <Button
            type="submit"
            disabled={isSubmitting || price === null}
            className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all duration-300 shadow-md"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Booking...
              </>
            ) : (
              <>
                <CalendarCheck className="h-4 w-4 mr-2" />
                Book Tour, {price !== null ? formatTourPrice(price) : 'N/A'}
              </>
            )}
          </Button>
        </div>

        <p className="text-[10px] text-center text-gray-400 font-medium">
          Pay the agent directly when you arrive. No online payment required.
        </p>
      </form>
    </div>
  );
}

// ── Confirmation Content ────────────────────────────────────

interface ConfirmationContentProps {
  booking: TourBooking;
  price: number | null;
  isLoggedIn: boolean;
  onGoogleSignIn: () => void;
  onClose: () => void;
}

function ConfirmationContent({
  booking,
  price,
  isLoggedIn,
  onGoogleSignIn,
  onClose,
}: ConfirmationContentProps) {
  const timeLabel =
    booking.preferred_time === 'morning'
      ? 'Morning'
      : booking.preferred_time === 'afternoon'
        ? 'Afternoon'
        : 'Evening';

  const tourTypeLabel =
    booking.tour_type === 'specific_hostel' ? 'Hostel Tour' : 'Zone Tour';

  const dateStr = new Date(
    booking.preferred_date + 'T00:00:00',
  ).toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="text-center py-4">
      {/* Success icon */}
      <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
        <Check className="h-8 w-8 text-emerald-600" />
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-1">Tour Booked!</h2>
      <p className="text-sm text-gray-500 mb-6">
        {isLoggedIn
          ? 'Your tour has been scheduled and linked to your account.'
          : 'Your hostel tour has been scheduled.'}
      </p>

      {/* Booking Summary */}
      <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Tour Type
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {tourTypeLabel}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Date
          </span>
          <span className="text-sm font-semibold text-gray-900">{dateStr}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Time
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {timeLabel}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Zone
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {booking.zone}
          </span>
        </div>
        <div className="h-px bg-gray-200" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Pay on Arrival
          </span>
          <span className="text-lg font-black text-slate-900">
            {price !== null
              ? formatTourPrice(price)
              : formatTourPrice(booking.amount)}
          </span>
        </div>
      </div>

      {/* Payment instruction */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
        <p className="text-sm font-semibold text-amber-900">
          Pay {formatTourPrice(booking.amount)} directly to the agent when you
          arrive.
        </p>
        <p className="text-xs text-amber-700 mt-1">
          Cash or direct Till payment accepted.
        </p>
      </div>

      {/* Google Account Linking — only for guests */}
      {!isLoggedIn && (
        <div className="mb-4">
          <div className="h-px bg-gray-100 mb-4" />
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Want to track this tour?
          </p>
          <Button
            onClick={onGoogleSignIn}
            variant="outline"
            className="w-full h-11 border-gray-200 hover:bg-gray-50 font-semibold text-gray-700 rounded-xl"
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
          <p className="text-[10px] text-gray-400 mt-2 font-medium">
            Optional, your booking is already confirmed
          </p>
        </div>
      )}

      {/* Done */}
      <div>
        <Button
          onClick={onClose}
          className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
