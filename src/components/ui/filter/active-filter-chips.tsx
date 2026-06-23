'use client';

import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import type { FilterState } from '@/stores/filter-store';

const ZONE_LABELS: Record<string, string> = {
  'Near Gate A': 'Gate A',
  'Near Gate B': 'Gate B',
  Boma: 'Boma',
  'Nyeri View': 'Nyeri View',
  'Kahawa Ridge': 'Kahawa Ridge',
  'Embassy Area': 'Embassy Area',
  Nyaribo: 'Nyaribo',
};

const AMENITY_LABELS: Record<string, string> = {
  'Laundry Area': 'Laundry',
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: 'Single Room',
  bedsitter: 'Bedsitter',
  self_contained: 'One Bedroom',
};

interface ActiveFilterChipsProps {
  filters: FilterState;
  onRemoveGender: (value: string) => void;
  onRemoveAmenity: (value: string) => void;
  onRemoveRoomType: (value: string) => void;
  onRemovePrice: () => void;
  onRemoveZone: (value: string) => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({
  filters,
  onRemoveGender,
  onRemoveAmenity,
  onRemoveRoomType,
  onRemovePrice,
  onRemoveZone,
  onClearAll,
}: ActiveFilterChipsProps) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  filters.genders.forEach((g) => {
    chips.push({
      key: `gender-${g}`,
      label: g === 'female' ? 'Female' : g === 'male' ? 'Male' : 'Mixed',
      onRemove: () => onRemoveGender(g),
    });
  });

  filters.amenities.forEach((a) => {
    chips.push({
      key: `amenity-${a}`,
      label: AMENITY_LABELS[a] ?? a,
      onRemove: () => onRemoveAmenity(a),
    });
  });

  filters.roomTypes.forEach((r) => {
    chips.push({
      key: `room-${r}`,
      label: ROOM_TYPE_LABELS[r] ?? r,
      onRemove: () => onRemoveRoomType(r),
    });
  });

  if (filters.minPrice || filters.maxPrice) {
    chips.push({
      key: 'price',
      label: `${formatCurrency(filters.minPrice ?? 1000)} – ${formatCurrency(filters.maxPrice ?? 30000)}`,
      onRemove: onRemovePrice,
    });
  }

  filters.zones.forEach((z) => {
    chips.push({
      key: `zone-${z}`,
      label: ZONE_LABELS[z] ?? z,
      onRemove: () => onRemoveZone(z),
    });
  });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition-all hover:bg-emerald-100 cursor-pointer"
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-rose-500 transition-all hover:bg-rose-50 cursor-pointer"
      >
        Clear all
      </button>
    </div>
  );
}
