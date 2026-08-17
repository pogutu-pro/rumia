'use client';

import { useState } from 'react';
import { getAmenityCategories } from '@/lib/utils/amenity-icons';

interface AmenitiesGridProps {
  amenities?: string[];
}

const COLLAPSE_THRESHOLD = 8;

export function AmenitiesGrid({ amenities }: AmenitiesGridProps) {
  const [expanded, setExpanded] = useState(false);

  if (!amenities || amenities.length === 0) return null;

  const categories = getAmenityCategories(amenities);
  if (categories.length === 0) return null;

  const totalCount = amenities.length;
  const showToggle = totalCount > COLLAPSE_THRESHOLD;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Amenities</h2>
      {categories.map((cat) => {
        const visibleItems = expanded ? cat.items : cat.items.slice(0, COLLAPSE_THRESHOLD);
        const hiddenCount = expanded ? 0 : Math.max(0, cat.items.length - COLLAPSE_THRESHOLD);
        return (
          <div key={cat.id} className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {cat.label}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-4">
                    <Icon className="h-6 w-6 text-slate-800 shrink-0" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-slate-900">{item.label}</span>
                  </div>
                );
              })}
            </div>
            {!expanded && hiddenCount > 0 && cat.id === categories[categories.length - 1]?.id && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="mt-2 text-sm font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-600 transition-colors"
              >
                Show all {totalCount} amenities
              </button>
            )}
          </div>
        );
      })}
      {expanded && showToggle && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-sm font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-600 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}
