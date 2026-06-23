'use client';

import { useState, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils/cn';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { GenderFilter } from './gender-filter';
import { AmenitiesFilter } from './amenities-filter';
import { RoomTypeFilter } from './room-type-filter';
import { PriceRangeFilter } from './price-range-filter';
import { LocationFilter } from './location-filter';
import type { FilterState } from '@/stores/filter-store';

interface FilterBottomSheetProps {
  currentFilters: FilterState;
  onApply: (filters: FilterState) => void;
}

export function FilterBottomSheet({ currentFilters, onApply }: FilterBottomSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(currentFilters);

  useEffect(() => {
    if (open) {
      setDraft(currentFilters);
    }
  }, [open, currentFilters]);

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleReset = () => {
    const empty: FilterState = {
      genders: [],
      amenities: [],
      roomTypes: [],
      minPrice: null,
      maxPrice: null,
      zones: [],
    };
    setDraft(empty);
  };

  const activeCount =
    currentFilters.genders.length +
    currentFilters.amenities.length +
    currentFilters.roomTypes.length +
    (currentFilters.minPrice || currentFilters.maxPrice ? 1 : 0) +
    currentFilters.zones.length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 cursor-pointer bg-emerald-500 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-600"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold">
              {activeCount}
            </span>
          )}
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-[100] flex flex-col rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl',
            'h-[85vh]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'data-[state=closed]:duration-300 data-[state=open]:duration-500',
          )}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-slate-300" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3">
            <DialogPrimitive.Title className="text-lg font-bold text-slate-900">
              Filters
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <Separator />

          {/* Scrollable content */}
          <ScrollArea className="flex-1 px-5 py-5">
            <div className="space-y-6">
              <GenderFilter
                selected={draft.genders}
                onChange={(v) => setDraft((prev) => ({ ...prev, genders: v }))}
              />
              <Separator />
              <AmenitiesFilter
                selected={draft.amenities}
                onChange={(v) => setDraft((prev) => ({ ...prev, amenities: v }))}
              />
              <Separator />
              <RoomTypeFilter
                selected={draft.roomTypes}
                onChange={(v) => setDraft((prev) => ({ ...prev, roomTypes: v }))}
              />
              <Separator />
              <PriceRangeFilter
                minPrice={draft.minPrice}
                maxPrice={draft.maxPrice}
                onChange={(min, max) => setDraft((prev) => ({ ...prev, minPrice: min, maxPrice: max }))}
              />
              <Separator />
              <LocationFilter
                selected={draft.zones}
                onChange={(v) => setDraft((prev) => ({ ...prev, zones: v }))}
              />
            </div>
          </ScrollArea>

          {/* Footer actions */}
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 rounded-xl border-2 border-slate-200 py-3 text-sm font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-[0.98] cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
