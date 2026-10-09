'use client';

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import {
  MessageCircle,
  Building2,
  UserCheck,
  Phone,
  X,
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
import { signInWithGoogle, getSession } from '@/lib/supabase/auth';
import { profilesApi } from '@/lib/api/profiles';
import { isValidKenyanPhone } from '@/lib/utils/phone';
import posthog from 'posthog-js';

// ── localStorage key for resuming flow after OAuth redirect ───────────────────
const PENDING_CONTACT_KEY = 'rumia_pending_contact';

export interface PendingContact {
  hostelId: string;
  hostelTitle: string;
  agentId: string;
  agentPhone: string;
  paysCommission: boolean;
  contactType: 'hostel_owner' | 'rumia_agent';
  returnPath: string;
}

/** Save pending contact state before Google OAuth redirect */
export function savePendingContact(state: PendingContact) {
  try {
    sessionStorage.setItem(PENDING_CONTACT_KEY, JSON.stringify(state));
  } catch {}
}

/** Read and clear pending contact state after OAuth redirect */
export function consumePendingContact(): PendingContact | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CONTACT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_CONTACT_KEY);
    return JSON.parse(raw) as PendingContact;
  } catch {
    return null;
  }
}

// ── Animation variants (matches BookTourForm exactly) ────────────────────────

const overlayVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

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

// ── Step types ────────────────────────────────────────────────────────────────

type Step = 'choose' | 'full' | 'phone' | 'fee' | 'redirecting';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  agentId: string;
  agentPhone: string;
  landlordPhone?: string | null;
  paysCommission: boolean;
  consultationFee?: number | null;
  isFull?: boolean;
  resumedContactType?: 'hostel_owner' | 'rumia_agent' | null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ContactModal({
  isOpen,
  onClose,
  listingId,
  listingTitle,
  agentId,
  agentPhone,
  landlordPhone,
  paysCommission,
  consultationFee,
  isFull,
  resumedContactType,
}: ContactModalProps) {
  const isMobile = useIsMobile();
  // Returns true only after hydration, so createPortal never runs on the server.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Flow state
  const [step, setStep] = useState<Step>('choose');
  const [contactType, setContactType] = useState<
    'hostel_owner' | 'rumia_agent' | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  // Hostel became fully occupied between render and click (server said so).
  // Reflect it locally so the choose step shows the "fully occupied" notice
  // with a continue/cancel choice instead of the normal two-option grid.
  const [fullLocked, setFullLocked] = useState(false);
  const isFullEffective = isFull || fullLocked;

  // Phone capture state
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneAttempts, setPhoneAttempts] = useState(0);

  // Lock body scroll
  useScrollLock(isOpen);

  // Reset when modal closes
  const handleClose = useCallback(() => {
    setStep('choose');
    setContactType(null);
    setPhone('');
    setPhoneError('');
    setPhoneAttempts(0);
    setFullLocked(false);
    onClose();
  }, [onClose]);

  // ── Core: Track lead + open WhatsApp ────────────────────────────────────────
  // Defined FIRST so all downstream callbacks can reference it via ref.
  const continueToWhatsApp = useCallback(
    async (
      type: 'hostel_owner' | 'rumia_agent',
      userPhone: string,
      feeAccepted: boolean,
    ) => {
      setIsLoading(true);

      // Fully occupied hostels can't take new owner bookings — never open
      // WhatsApp directly. Show the dedicated notice with continue/cancel.
      if (isFullEffective && type === 'hostel_owner') {
        setIsLoading(false);
        setContactType('rumia_agent');
        setStep('full');
        return;
      }

      // For Rumia Agent on a non-commission hostel → show fee modal first
      if (type === 'rumia_agent' && !paysCommission && !feeAccepted) {
        setIsLoading(false);
        setStep('fee');
        return;
      }

      setStep('redirecting');

      let shouldClose = true;

      try {
        const { session } = await getSession();
        let name: string | undefined;
        if (session?.user) {
          const profile = await profilesApi.getMe().catch(() => null);
          name = profile?.full_name ?? undefined;
        }

        const response = await fetch('/api/track-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listing_id: listingId,
            agent_id: agentId,
            contact_type: type,
            name,
            phone: userPhone,
            fee_accepted: feeAccepted,
          }),
        });

        const data = await response.json();

        if (response.status === 409 && data.requiresFee) {
          shouldClose = false;
          setIsLoading(false);
          setStep('fee');
          return;
        }

        if (response.status === 409 && data.requiresAgent) {
          // Listing became fully occupied between render and this request —
          // show the fully occupied notice with continue/cancel instead of
          // silently dropping the user back to the normal two-option grid.
          shouldClose = false;
          setIsLoading(false);
          setFullLocked(true);
          setStep('full');
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || 'Failed to record lead');
        }

        if (data.whatsappUrl) {
          posthog.capture('contact_whatsapp_opened', {
            listing_id: listingId,
            contact_type: type,
            pays_commission: paysCommission,
            fee_accepted: feeAccepted,
          });
          window.open(data.whatsappUrl, '_blank');
          toast.success('Opening WhatsApp…');
        } else {
          throw new Error('No WhatsApp URL returned');
        }
      } catch (err) {
        posthog.captureException(err);
        console.error('Track lead error:', err);
        // Graceful fallback — still open WhatsApp.
         const {
          buildWhatsAppUrl,
          hostelOwnerMessage,
          agentHostelInquiryMessage,
          agentInquiryMessage,
        } = await import('@/lib/utils/phone');
        const fallbackPhone =
          type === 'hostel_owner' && landlordPhone ? landlordPhone : agentPhone;
        let msg: string;
        if (type === 'hostel_owner') {
          msg = hostelOwnerMessage({ title: listingTitle });
        } else {
          msg = agentHostelInquiryMessage({
            listingTitle: listingTitle,
            agentName: 'your agent',
            whatsapp: fallbackPhone,
            consultationFee: consultationFee || undefined,
            isFull: isFullEffective,
          });
        }
        window.open(buildWhatsAppUrl(fallbackPhone, msg), '_blank');
        toast.error('Lead tracking failed, connecting directly…');
      } finally {
        setIsLoading(false);
        if (shouldClose) {
          handleClose();
        }
      }
    },
    [listingId, agentId, listingTitle, agentPhone, landlordPhone, paysCommission, consultationFee, isFullEffective, handleClose],
  );

  // Ref always holds the latest continueToWhatsApp, avoiding stale closures
  // in handleContactTypeSelect / handlePhoneSubmit / handleFeeAccepted.
  const continueRef = useRef(continueToWhatsApp);
  useEffect(() => {
    continueRef.current = continueToWhatsApp;
  }, [continueToWhatsApp]);

  // ── Step 1: User picks a contact type ───────────────────────────────────────
  const handleContactTypeSelect = useCallback(
    async (type: 'hostel_owner' | 'rumia_agent') => {
      // When the hostel is fully occupied, show the notice with a
      // continue/cancel choice instead of silently redirecting the user.
      if (isFullEffective && type === 'hostel_owner') {
        setContactType('rumia_agent');
        setStep('full');
        return;
      }

      setContactType(type);
      setIsLoading(true);

      try {
        const { session } = await getSession();

        if (!session?.user) {
          const pending: PendingContact = {
            hostelId: listingId,
            hostelTitle: listingTitle,
            agentId,
            agentPhone,
            paysCommission,
            contactType: type,
            returnPath: window.location.pathname,
          };
          savePendingContact(pending);
          const { error } = await signInWithGoogle(window.location.pathname);
          if (error) {
            setIsLoading(false);
            return;
          }
          return;
        }

        const profile = await profilesApi.getMe().catch(() => null);

        if (!profile?.phone || !isValidKenyanPhone(profile.phone)) {
          setIsLoading(false);
          setStep('phone');
          return;
        }

        await continueRef.current(type, profile.phone, false);
      } catch (err) {
        console.error('Contact flow error:', err);
        toast.error('Something went wrong. Please try again.');
        setIsLoading(false);
      }
    },
    [listingId, listingTitle, agentId, agentPhone, paysCommission, isFullEffective],
  );

  // Handle seamless resumption after OAuth. Deferred past the commit so the
  // async contact flow never performs synchronous state updates in an effect.
  useEffect(() => {
    if (isOpen && resumedContactType) {
      const timer = setTimeout(() => {
        void handleContactTypeSelect(resumedContactType);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, resumedContactType, handleContactTypeSelect]);

  // ── Step 2 (optional): Phone capture ────────────────────────────────────────
  const handlePhoneSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPhoneError('');

      if (!isValidKenyanPhone(phone)) {
        const attempts = phoneAttempts + 1;
        setPhoneAttempts(attempts);
        if (attempts >= 2) {
          setPhoneError(
            "That number still doesn't look right. Please try again — use a valid Kenyan number like 0712 345 678.",
          );
        } else {
          setPhoneError(
            "That doesn't look like a valid Kenyan number. Please try again (e.g. 0712 345 678).",
          );
        }
        toast.error('Invalid phone number. Please try again.');
        return;
      }

      setSavingPhone(true);
      try {
        const { session } = await getSession();
        if (!session?.user) {
          toast.error('Session expired. Please try again.');
          setSavingPhone(false);
          return;
        }

        await profilesApi.updateMe({ phone: phone.trim() });

        setSavingPhone(false);
        await continueRef.current(contactType!, phone.trim(), false);
      } catch (err) {
        console.error('Phone save error:', err);
        toast.error('Failed to save phone number. Please try again.');
        setSavingPhone(false);
      }
    },
    [phone, contactType, phoneAttempts],
  );

  // ── Step 3 (optional): Fee disclosure accepted ───────────────────────────────
  const handleFeeAccepted = useCallback(async () => {
    posthog.capture('fee_disclosure_accepted', { listing_id: listingId });
    const profile = await profilesApi.getMe().catch(() => null);

    await continueRef.current(contactType!, profile?.phone ?? '', true);
  }, [contactType, listingId]);

  if (!mounted) return null;

  const content = (
    <ModalContent
      step={step}
      contactType={contactType}
      isLoading={isLoading}
      phone={phone}
      setPhone={setPhone}
      phoneError={phoneError}
      setPhoneError={setPhoneError}
      savingPhone={savingPhone}
      paysCommission={paysCommission}
      consultationFee={consultationFee}
      isFull={isFullEffective}
      onChooseHostelOwner={() => handleContactTypeSelect('hostel_owner')}
      onChooseRumiaAgent={() => handleContactTypeSelect('rumia_agent')}
      onPhoneSubmit={handlePhoneSubmit}
      onFeeAccepted={handleFeeAccepted}
      onClose={handleClose}
    />
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-label="Contact hostel"
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={handleClose}
          />

          {isMobile ? (
            /* Mobile bottom sheet */
            <motion.div
              className="absolute inset-x-0 bottom-0 bg-white rounded-t-[24px] flex flex-col max-h-[85vh] overflow-y-auto shadow-[0_-4px_30px_rgba(0,0,0,0.12)]"
              variants={mobileSheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex justify-center pt-3 pb-1 px-6">
                <div className="w-9 h-[3px] bg-gray-300 rounded-full" />
              </div>
              <div className="px-5 pb-8 pt-2">{content}</div>
            </motion.div>
          ) : (
            /* Desktop centred modal */
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                className="w-full max-w-[460px] bg-white rounded-[20px] shadow-[0_8px_40px_rgba(0,0,0,0.15)] max-h-[90vh] overflow-y-auto pointer-events-auto"
                variants={desktopModalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="p-6">{content}</div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ── Inner modal content (step-driven) ────────────────────────────────────────

interface ModalContentProps {
  step: Step;
  contactType: 'hostel_owner' | 'rumia_agent' | null;
  isLoading: boolean;
  phone: string;
  setPhone: (v: string) => void;
  phoneError: string;
  setPhoneError: (v: string) => void;
  savingPhone: boolean;
  paysCommission: boolean;
  consultationFee?: number | null;
  isFull?: boolean;
  onChooseHostelOwner: () => void;
  onChooseRumiaAgent: () => void;
  onPhoneSubmit: (e: React.FormEvent) => void;
  onFeeAccepted: () => void;
  onClose: () => void;
}

function ModalContent({
  step,
  contactType,
  isLoading,
  phone,
  setPhone,
  phoneError,
  setPhoneError,
  savingPhone,
  paysCommission,
  consultationFee,
  isFull,
  onChooseHostelOwner,
  onChooseRumiaAgent,
  onPhoneSubmit,
  onFeeAccepted,
  onClose,
}: ModalContentProps) {
  // ── Redirecting spinner ──
  if (step === 'redirecting') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-slate-600">
          Opening WhatsApp…
        </p>
      </div>
    );
  }

  // ── Phone step ──
  if (step === 'phone') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Your WhatsApp Number
            </h2>
            <p className="text-xs text-gray-500">Required to continue</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-emerald-900 mb-1">
            Why we need this
          </p>
          <p className="text-xs text-emerald-700 leading-relaxed">
            Please enter the WhatsApp number you actually use. This number will
            be used when contacting hostel owners and Rumia agents.
          </p>
        </div>

        <form onSubmit={onPhoneSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="contact-phone"
              className="text-sm font-semibold text-gray-700"
            >
              Phone number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="contact-phone"
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
                autoFocus
                required
              />
            </div>
            {phoneError && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {phoneError}
              </p>
            )}
            <p className="text-[11px] text-gray-400 font-medium">
              Kenyan numbers only · saved to your profile · never shown publicly
            </p>
          </div>

          <Button
            type="submit"
            disabled={
              savingPhone ||
              !phone.trim() ||
              (phone.trim().length >= 9 && !isValidKenyanPhone(phone))
            }
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all duration-300 border-0"
          >
            {savingPhone ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </div>
    );
  }

  // ── Fully occupied notice step (or choose step when hostel is full) ──
  if (step === 'full' || (step === 'choose' && isFull)) {
    const feeDisplay =
      consultationFee && consultationFee > 0
        ? `KES ${consultationFee.toLocaleString()}`
        : 'KES 1,000';

    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              This hostel is fully occupied
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Rooms are all taken right now
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-5">
          <p className="text-sm text-amber-900 leading-relaxed">
            This hostel is currently <span className="font-bold">full</span>. A Rumia agent can help you find available alternatives for a consultation fee of{' '}
            <span className="font-bold">{feeDisplay}</span>.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={onChooseRumiaAgent}
            disabled={isLoading}
            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl border-0 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Opening…
              </>
            ) : (
              'Continue with Agent'
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Fee disclosure step ──
  if (step === 'fee') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Get the real details
            </h2>
            <p className="text-xs text-gray-500">
              Insider information from the agent
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-5">
          <p className="text-sm text-amber-900 leading-relaxed">
            Get professional guidance from a verified Rumia agent to evaluate this property against your budget, location preferences, and requirements.
            {consultationFee && consultationFee > 0 ? (
              <> A consultation fee of <span className="font-bold">KES {consultationFee.toLocaleString()}</span> applies, paid directly to the agent.</>
            ) : (
              <> A consultation fee applies, paid directly to the agent.</>
            )}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={onFeeAccepted}
            disabled={isLoading}
            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl border-0 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Opening…
              </>
            ) : (
              'Accept and Continue'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Contact</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Who would you like to speak to?
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Hostel Owner */}
        <button
          onClick={onChooseHostelOwner}
          disabled={isLoading && contactType === 'hostel_owner'}
          className={cn(
            'flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 text-left',
            'border-slate-200 hover:border-slate-900 hover:bg-slate-50',
            'disabled:opacity-60 disabled:cursor-wait',
            isLoading &&
              contactType === 'hostel_owner' &&
              'border-slate-900 bg-slate-50',
          )}
          aria-label="Contact Hostel Owner"
        >
          {isLoading && contactType === 'hostel_owner' ? (
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-slate-700" />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-slate-900 text-center">
              Hostel Owner
            </p>
            <p className="text-[11px] text-slate-500 text-center mt-0.5 leading-snug">
              Speak directly with the landlord
            </p>
          </div>
        </button>

        {/* Rumia Agent */}
        <button
          onClick={onChooseRumiaAgent}
          disabled={isLoading && contactType === 'rumia_agent'}
          className={cn(
            'flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 text-left',
            'border-emerald-200 hover:border-emerald-600 hover:bg-emerald-50/50',
            'disabled:opacity-60 disabled:cursor-wait',
            isLoading &&
              contactType === 'rumia_agent' &&
              'border-emerald-600 bg-emerald-50/50',
          )}
          aria-label="Contact Rumia Agent"
        >
          {isLoading && contactType === 'rumia_agent' ? (
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-slate-900 text-center">
              Rumia Agent
            </p>
            <p className="text-[11px] text-slate-500 text-center mt-0.5 leading-snug">
              Get guided help from an expert
            </p>
          </div>
        </button>
      </div>

      <p className="text-center text-[11px] text-slate-400 font-medium mt-4">
        <MessageCircle className="inline h-3 w-3 mr-0.5 -mt-0.5" />
        Connects via WhatsApp
      </p>
    </div>
  );
}
