'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Check, MapPin, ArrowLeft, Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { useIsMobile } from '@/hooks/use-media-query';
import { createClient } from '@/lib/supabase/client';

interface HostelOption {
  id: string;
  title: string;
  price: number;
  location: string;
  agent_name: string | null;
  image_url: string | null;
}

interface HostelPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selected: HostelOption[]) => void;
  zone: string;
}

const MAX_SELECTION = 4;

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const desktopModalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 8 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring' as const, damping: 28, stiffness: 340, mass: 0.9 },
  },
  exit: {
    opacity: 0, scale: 0.92, y: 8,
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

export function HostelPickerModal({
  isOpen,
  onClose,
  onConfirm,
  zone,
}: HostelPickerModalProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch hostels in the zone
  useEffect(() => {
    if (!isOpen || !zone) return;

    let cancelled = false;

    async function fetchHostels() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('listings')
          .select(`
            id,
            title,
            price,
            location,
            agents ( name ),
            listing_images ( r2_url, display_order )
          `)
          .eq('is_active', true)
          .eq('area', zone)
          .order('created_at', { ascending: false });

        if (!cancelled && data) {
          setHostels(
            data.map((l: any) => {
              const sorted = [...(l.listing_images || [])].sort(
                (a: any, b: any) => a.display_order - b.display_order,
              );
              return {
                id: l.id,
                title: l.title,
                price: l.price,
                location: l.location,
                agent_name: l.agents?.name || null,
                image_url: sorted[0]?.r2_url || null,
              };
            }),
          );
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHostels();
    return () => { cancelled = true; };
  }, [isOpen, zone]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelected(new Set());
      setSearch('');
    }
  }, [isOpen]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTION) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const picked = hostels.filter((h) => selected.has(h.id));
    onConfirm(picked);
  }, [hostels, selected, onConfirm]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!mounted) return null;

  const filtered = hostels.filter(
    (h) =>
      h.title.toLowerCase().includes(search.toLowerCase()) ||
      h.location.toLowerCase().includes(search.toLowerCase()),
  );

  const content = (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">Pick hostels to tour</h2>
          <p className="text-xs text-gray-500">
            Up to {MAX_SELECTION} hostels in {zone}
          </p>
        </div>
        {selected.size > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
            {selected.size}/{MAX_SELECTION}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Input
          type="text"
          placeholder="Search hostels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-4 pr-4 text-sm"
        />
      </div>

      {/* Hostel list */}
      <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 space-y-2">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Loading hostels in {zone}...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No hostels found in {zone}.
          </div>
        ) : (
          filtered.map((hostel) => {
            const isSelected = selected.has(hostel.id);
            const disabled = !isSelected && selected.size >= MAX_SELECTION;

            return (
              <button
                key={hostel.id}
                type="button"
                onClick={() => toggle(hostel.id)}
                disabled={disabled}
                className={cn(
                  'w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all duration-200',
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50'
                    : disabled
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-gray-300 bg-white',
                )}
              >
                {/* Hostel image */}
                <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                  {hostel.image_url ? (
                    <Image
                      src={hostel.image_url}
                      alt={hostel.title}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-gray-300" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {hostel.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {hostel.location}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-emerald-600 mt-0.5">
                    KSh {hostel.price.toLocaleString()}/mo
                  </p>
                </div>

                <div
                  className={cn(
                    'shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                    isSelected
                      ? 'border-emerald-600 bg-emerald-600'
                      : 'border-gray-300',
                  )}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Confirm */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <Button
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
        >
          <Building2 className="h-4 w-4 mr-2" />
          {selected.size === 0
            ? 'Select at least 1 hostel'
            : `Tour ${selected.size} hostel${selected.size > 1 ? 's' : ''} — KSh 300`}
        </Button>
        <p className="text-[10px] text-center text-gray-400 font-medium mt-2">
          Pay the agent directly when you arrive.
        </p>
      </div>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[110]"
          role="dialog"
          aria-modal="true"
          aria-label="Pick hostels to tour"
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {isMobile ? (
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
              <div className="px-5 pb-6 pt-2">{content}</div>
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                className={cn(
                  'w-full max-w-[480px]',
                  'bg-white rounded-[20px]',
                  'shadow-[0_8px_40px_rgba(0,0,0,0.15)]',
                  'max-h-[90vh] overflow-y-auto',
                  'pointer-events-auto p-6',
                )}
                variants={desktopModalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {content}
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
