'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { useIsMobile } from '@/hooks/use-media-query';
import { saveProfileCompletionAction } from '@/app/actions/profile';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  userId: string;
  currentName: string | null;
  currentPhone: string | null;
  currentCampusId?: string | null;
  currentCampusName?: string | null;
  campuses?: Array<{ id: string; name: string }>;
  /** Only render + validate the fields that are actually missing. */
  requireName?: boolean;
  requirePhone?: boolean;
  requireCampus?: boolean;
  onSuccess: (data: {
    full_name?: string;
    phone?: string;
    home_campus_id?: string | null;
    home_campus_name?: string | null;
    home_campus_confirmed_at?: string | null;
  }) => void;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const desktopModalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
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
    scale: 0.95,
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

export function ProfileCompletionModal({
  isOpen,
  userId,
  currentName,
  currentPhone,
  campuses = [],
  currentCampusId = null,
  currentCampusName = null,
  requireName = true,
  requirePhone = true,
  requireCampus = true,
  onSuccess,
}: ProfileCompletionModalProps) {
  const isMobile = useIsMobile();
  // Returns true only after hydration, so the modal never mismatches SSR.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [fullName, setFullName] = useState(currentName || '');
  const [phone, setPhone] = useState(currentPhone || '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [campusInput, setCampusInput] = useState('');
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Prefill campus input: prefer the user's stored campus name (e.g. a
  // university they typed that isn't in the registry), else resolve the id.
  // Sync when the props change — derived-state adjustment during render.
  const [prevCampusId, setPrevCampusId] = useState(currentCampusId);
  const [prevCampusName, setPrevCampusName] = useState(currentCampusName);
  const [prevCampusList, setPrevCampusList] = useState(campuses);
  if (
    currentCampusId !== prevCampusId ||
    currentCampusName !== prevCampusName ||
    campuses !== prevCampusList
  ) {
    setPrevCampusId(currentCampusId);
    setPrevCampusName(currentCampusName);
    setPrevCampusList(campuses);
    if (currentCampusName) {
      setCampusInput(currentCampusName);
    } else if (currentCampusId) {
      const matched = campuses.find((c) => c.id === currentCampusId);
      setCampusInput(matched ? matched.name : String(currentCampusId));
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (requireName && !fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    if (requirePhone) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const localPattern = /^(0[17]\d{8})$/;
      const internationalPattern = /^(?:254)([17]\d{8})$/;

      if (!normalizedPhone) {
        setPhoneError('Please enter your phone number');
        return;
      }
      if (
        !localPattern.test(normalizedPhone) &&
        !internationalPattern.test(normalizedPhone)
      ) {
        setPhoneError(
          'Please enter a valid Kenyan number starting with 01, 07, +2541 or +2547',
        );
        return;
      }
      setPhoneError(null);
    }

    if (requireCampus && !campusInput.trim()) {
      toast.error('Please enter or choose your university/campus');
      return;
    }

    setIsSaving(true);
    try {
      let homeCampusId: string | null = null;

      if (requireCampus) {
        // Determine if campusInput matches an existing campus name (case-insensitive)
        const matched = campuses.find(
          (c) => c.name.toLowerCase() === campusInput.trim().toLowerCase(),
        );
        homeCampusId = matched ? matched.id : null;

        // If no match, record a lightweight suggestion event (admins will review)
        // so unvalidated campus entries are visible for review.
        if (!homeCampusId) {
          try {
            const posthog = (await import('posthog-js')).default;
            if (posthog && posthog.capture) {
              posthog.capture('campus_suggested', {
                user_id: userId,
                name: campusInput.trim(),
              });
            }
          } catch (err) {
            // ignore analytics failures
          }
        }
      }

      // Write through the server action so the save is atomic. The action
      // resolves the matched campus server-side, so the truth comes from the
      // `campuses` table rather than the client render prop.
      const result = await saveProfileCompletionAction({
        ...(requireName ? { full_name: fullName.trim() } : {}),
        ...(requirePhone ? { phone: phone.trim() } : {}),
        ...(requireCampus ? { campus_input: campusInput.trim() } : {}),
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      onSuccess({
        ...(result.updated.full_name !== undefined
          ? { full_name: result.updated.full_name }
          : {}),
        ...(result.updated.phone !== undefined
          ? { phone: result.updated.phone }
          : {}),
        ...(result.updated.home_campus_id !== undefined
          ? { home_campus_id: result.updated.home_campus_id }
          : {}),
        ...(result.updated.home_campus_name !== undefined
          ? { home_campus_name: result.updated.home_campus_name }
          : {}),
        ...(result.updated.home_campus_confirmed_at !== undefined
          ? { home_campus_confirmed_at: result.updated.home_campus_confirmed_at }
          : {}),
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Unable to update profile right now. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const formContent = (
    <form onSubmit={handleSave} className="space-y-5">
      {requireName && (
        <div className="space-y-2">
          <Label
            htmlFor="pc-name"
            className="text-sm font-semibold text-gray-700"
          >
            Full name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="pc-name"
              type="text"
              placeholder="e.g. John Kamau"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 pl-10 border-gray-300 focus:border-gray-500"
              autoFocus
              required
            />
          </div>
        </div>
      )}

      {requirePhone && (
        <div className="space-y-2">
          <Label
            htmlFor="pc-phone"
            className="text-sm font-semibold text-gray-700"
          >
            Phone number
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="pc-phone"
              type="tel"
              placeholder="e.g. 0712 345 678"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneError) setPhoneError(null);
              }}
              className="h-11 pl-10 border-gray-300 focus:border-gray-500"
              required
            />
          </div>
          {phoneError ? (
            <p className="text-xs text-red-600 mt-1">{phoneError}</p>
          ) : null}
        </div>
      )}

      {requireCampus && (
        <div className="space-y-2">
          <Label
            htmlFor="pc-campus"
            className="text-sm font-semibold text-gray-700"
          >
            University / Campus
          </Label>
          <div className="relative">
            <Input
              id="pc-campus"
              list="campus-list"
              type="text"
              placeholder="Start typing or choose from the list"
              value={campusInput}
              onChange={(e) => {
                setCampusInput(e.target.value);
                setSuggestionsVisible(true);
              }}
              onFocus={() => setSuggestionsVisible(true)}
              onBlur={() => setTimeout(() => setSuggestionsVisible(false), 150)}
              className="h-11 pl-3 border-gray-300 focus:border-gray-500"
              autoFocus={!requireName && !requirePhone}
              required
            />
            <datalist id="campus-list">
              {campuses.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={isSaving}
        className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            Continue
          </>
        )}
      </Button>
    </form>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[110]"
          role="dialog"
          aria-modal="true"
          aria-label="Complete your profile"
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
          />

          {isMobile ? (
            <motion.div
              className={cn(
                'absolute inset-x-0 bottom-0',
                'bg-white rounded-t-[24px]',
                'flex flex-col',
                'max-h-[85vh] overflow-y-auto',
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
              <div className="px-5 pb-8 pt-2">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-gray-900">
                    Complete your profile
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Required to book tours and track your activity.
                  </p>
                </div>
                <div className="relative">
                  {formContent}

                  {/* Suggestions dropdown (simple substring match) */}
                  {suggestionsVisible && (
                    <div className="absolute left-5 right-5 mt-2 bg-white border border-gray-200 rounded shadow z-50 max-h-40 overflow-y-auto">
                      {campuses
                        .filter((c) =>
                          campusInput.trim().length > 0
                            ? c.name
                                .toLowerCase()
                                .includes(campusInput.trim().toLowerCase())
                            : true,
                        )
                        .slice(0, 6)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCampusInput(c.name);
                              setSuggestionsVisible(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                          >
                            {c.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                className={cn(
                  'w-full max-w-[420px]',
                  'bg-white rounded-[20px]',
                  'shadow-[0_8px_40px_rgba(0,0,0,0.15)]',
                  'p-6',
                  'pointer-events-auto',
                )}
                variants={desktopModalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-gray-900">
                    Complete your profile
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Required to book tours and track your activity.
                  </p>
                </div>
                <div className="relative">
                  {formContent}

                  {/* Suggestions dropdown (simple substring match) */}
                  {suggestionsVisible && campusInput.trim().length > 0 && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded shadow z-50 max-h-40 overflow-y-auto">
                      {campuses
                        .filter((c) =>
                          c.name
                            .toLowerCase()
                            .includes(campusInput.trim().toLowerCase()),
                        )
                        .slice(0, 6)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCampusInput(c.name);
                              setSuggestionsVisible(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                          >
                            {c.name}
                          </button>
                        ))}
                    </div>
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
