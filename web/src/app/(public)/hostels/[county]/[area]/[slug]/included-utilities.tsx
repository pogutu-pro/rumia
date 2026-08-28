'use client';

import { useState } from 'react';
import { getUtilityMeta } from '@/lib/utils/amenity-icons';

interface IncludedUtilitiesProps {
  waterIncluded?: boolean;
  electricityIncluded?: boolean;
  wifiIncluded?: boolean;
  hotWaterIncluded?: boolean;
  cookingGasIncluded?: boolean;
  securityType?: string;
}

const SHOW_MORE_THRESHOLD = 6;

export function IncludedUtilities({
  waterIncluded,
  electricityIncluded,
  wifiIncluded,
  hotWaterIncluded,
  cookingGasIncluded,
  securityType,
}: IncludedUtilitiesProps) {
  const [expanded, setExpanded] = useState(false);

  const items = [
    { key: 'Water', label: 'Water', show: !!waterIncluded },
    { key: 'Electricity', label: 'Electricity', show: !!electricityIncluded },
    { key: 'WiFi', label: 'WiFi', show: !!wifiIncluded },
    { key: 'Hot Water', label: 'Hot Water', show: !!hotWaterIncluded },
    { key: 'Cooking Gas', label: 'Cooking Gas', show: !!cookingGasIncluded },
    { key: 'Security', label: securityType ? `Security ${securityType}` : 'Security', show: !!securityType },
  ].filter((i) => i.show);

  const visibleItems = expanded ? items : items.slice(0, SHOW_MORE_THRESHOLD);
  const hiddenCount = items.length - SHOW_MORE_THRESHOLD;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Included in Rent</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
        {visibleItems.map((item) => {
          const meta = getUtilityMeta(item.key);
          const Icon = meta.icon;
          return (
            <div key={item.key} className="flex items-center gap-4">
              <Icon className="h-6 w-6 text-slate-800 shrink-0" strokeWidth={1.5} />
              <span className="text-sm font-medium text-slate-900">{item.label}</span>
            </div>
          );
        })}
      </div>
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-600 transition-colors"
        >
          Show all {items.length} items
        </button>
      )}
      {expanded && hiddenCount > 0 && (
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
