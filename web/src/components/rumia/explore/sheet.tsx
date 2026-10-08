'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** A modal panel: bottom sheet on phones, centred card on larger screens. Native <dialog> gives focus trap and Escape. */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="sheet-title"
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-2xl bg-rum-raised p-0 text-rum-text backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-rum-media"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="flex items-center justify-between border-b border-rum-line px-5 py-3">
          <h2 id="sheet-title" className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-rum-sunken">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-rum-line px-5 py-3">{footer}</div>}
      </div>
    </dialog>
  );
}
