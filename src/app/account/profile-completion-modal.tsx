'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { useIsMobile } from '@/hooks/use-media-query';
import { createClient } from '@/lib/supabase/client';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  userId: string;
  currentName: string | null;
  currentPhone: string | null;
  onSuccess: (data: { full_name: string; phone: string }) => void;
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
    transition: { type: 'spring' as const, damping: 28, stiffness: 340, mass: 0.9 },
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
    transition: { type: 'spring' as const, damping: 32, stiffness: 320, mass: 1 },
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
  onSuccess,
}: ProfileCompletionModalProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [fullName, setFullName] = useState(currentName || '');
  const [phone, setPhone] = useState(currentPhone || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 7) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      onSuccess({ full_name: fullName.trim(), phone: phone.trim() });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  }

  const formContent = (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="pc-name" className="text-sm font-semibold text-gray-700">
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

      <div className="space-y-2">
        <Label htmlFor="pc-phone" className="text-sm font-semibold text-gray-700">
          Phone number
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="pc-phone"
            type="tel"
            placeholder="e.g. 0712 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 pl-10 border-gray-300 focus:border-gray-500"
            required
          />
        </div>
      </div>

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
        <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label="Complete your profile">
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
                  <h2 className="text-lg font-bold text-gray-900">Complete your profile</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Required to book tours and track your activity.
                  </p>
                </div>
                {formContent}
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
                  <h2 className="text-lg font-bold text-gray-900">Complete your profile</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Required to book tours and track your activity.
                  </p>
                </div>
                {formContent}
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
