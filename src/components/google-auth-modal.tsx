'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/dialog';
import { onGoogleAuthBlocked } from '@/lib/google-auth';

export function GoogleAuthModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return onGoogleAuthBlocked(() => setOpen(true));
  }, []);

  return (
    <>
      {children}
      <GoogleAuthModal open={open} onOpenChange={setOpen} />
    </>
  );
}

function GoogleAuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-2">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 ring-1 ring-blue-100">
            <ShieldCheck className="h-8 w-8 text-blue-600" strokeWidth={1.5} />
          </div>

          <ModalHeader className="px-0 pb-0">
            <ModalTitle className="text-xl font-semibold text-slate-900">
              Google Sign-In Temporarily Unavailable
            </ModalTitle>
          </ModalHeader>

          <ModalDescription className="mt-3 text-[15px] leading-relaxed text-slate-500">
            We&apos;re currently improving the Google Sign-In experience to ensure it meets our
            security and branding standards. Please check back soon.
          </ModalDescription>

          <p className="mt-4 text-sm text-slate-400">
            Thank you for your patience as we make Rumia even better.
          </p>
        </div>

        <ModalFooter className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 sm:w-auto sm:px-8"
          >
            Got it
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
