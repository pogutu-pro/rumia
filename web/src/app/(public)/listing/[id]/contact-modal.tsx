'use client';

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import {
  MessageCircle,
  Building2,
  UserCheck,
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
import { getSession } from '@/lib/supabase/auth';
import { profilesApi } from '@/lib/api/profiles';
import { rumia } from '@/lib/api/rumia';
import { rememberFollowUp, withReference } from '@/lib/contact';
import posthog from 'posthog-js';

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

/** Best-effort: a failure here never blocks the contact. Returns the reference code. */
async function logInquiry(listingId: string, title: string): Promise<string | null> {
  try {
    const { data } = await rumia.POST('/api/v1/inquiries', {
      body: { listing_id: listingId, channel: 'whatsapp', source: 'property' },
    });
    if (!data) return null;
    rememberFollowUp({ ref: data.ref_code, name: data.contact_name || title, at: Date.now() });
    return data.ref_code;
  } catch {
    return null;
  }
}

// ── Step types ────────────────────────────────────────────────────────────────

type Step = 'choose' | 'full' | 'fee' | 'redirecting';

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


  // Lock body scroll
  useScrollLock(isOpen);

  // Reset when modal closes
  const handleClose = useCallback(() => {
    setStep('choose');
    setContactType(null);
    setFullLocked(false);
    onClose();
  }, [onClose]);

  // ── Core: Track lead + open WhatsApp ────────────────────────────────────────
  // Defined FIRST so all downstream callbacks can reference it via ref.
  const continueToWhatsApp = useCallback(
    async (
      type: 'hostel_owner' | 'rumia_agent',
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
          // Also log a reference-coded inquiry so the visitor can later say whether the place replied.
          const ref = await logInquiry(listingId, listingTitle);
          if (ref) data.whatsappUrl = withReference(data.whatsappUrl, ref);
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
  // in handleContactTypeSelect / handleFeeAccepted.
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

      // No account or phone number is needed to contact a place.
      setContactType(type);
      setIsLoading(true);
      try {
        await continueRef.current(type, false);
      } catch (err) {
        console.error('Contact flow error:', err);
        toast.error('Something went wrong. Please try again.');
        setIsLoading(false);
      }
    },
    [isFullEffective],
  );

  // ── Step 2 (optional): Fee disclosure accepted ───────────────────────────────
  const handleFeeAccepted = useCallback(async () => {
    posthog.capture('fee_disclosure_accepted', { listing_id: listingId });
    await continueRef.current(contactType!, true);
  }, [contactType, listingId]);

  if (!mounted) return null;

  const content = (
    <ModalContent
      step={step}
      contactType={contactType}
      isLoading={isLoading}
      paysCommission={paysCommission}
      consultationFee={consultationFee}
      isFull={isFullEffective}
      onChooseHostelOwner={() => handleContactTypeSelect('hostel_owner')}
      onChooseRumiaAgent={() => handleContactTypeSelect('rumia_agent')}
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
  paysCommission: boolean;
  consultationFee?: number | null;
  isFull?: boolean;
  onChooseHostelOwner: () => void;
  onChooseRumiaAgent: () => void;
  onFeeAccepted: () => void;
  onClose: () => void;
}

function ModalContent({
  step,
  contactType,
  isLoading,
  paysCommission,
  consultationFee,
  isFull,
  onChooseHostelOwner,
  onChooseRumiaAgent,
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
