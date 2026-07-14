'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Switch } from '@/components/ui/switch';

const DISTANCE_OPTIONS = [
  { value: 100, label: 'Within 100m' },
  { value: 250, label: 'Within 250m' },
  { value: 500, label: 'Within 500m (Walking distance)' },
  { value: 1000, label: 'Within 1km' },
  { value: 2000, label: 'Within 2km' },
  { value: 3000, label: 'Within 3km' },
];

interface DistanceFilterProps {
  maxDistance: number | null;
  sortByNearest: boolean;
  onChangeMaxDistance: (value: number | null) => void;
  onChangeSortByNearest: (value: boolean) => void;
}

export function DistanceFilter({
  maxDistance,
  sortByNearest,
  onChangeMaxDistance,
  onChangeSortByNearest,
}: DistanceFilterProps) {
  return (
    <div className="space-y-6">
      {/* Distance options */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-900">Distance from campus</label>
        <div className="space-y-1">
          {DISTANCE_OPTIONS.map((option) => {
            const isActive = maxDistance === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onChangeMaxDistance(isActive ? null : option.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
                    isActive
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white',
                  )}
                >
                  {isActive && <Check className="h-3 w-3" />}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional: Sort by nearest first */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="space-y-0.5">
          <label className="text-sm font-semibold text-slate-900 cursor-pointer" htmlFor="sort-nearest-toggle">
            Sort by nearest first
          </label>
          <p className="text-xs text-slate-400 font-medium">
            Order results starting with the closest to campus center
          </p>
        </div>
        <Switch
          id="sort-nearest-toggle"
          checked={sortByNearest}
          onCheckedChange={onChangeSortByNearest}
          className="data-[state=checked]:bg-emerald-500"
        />
      </div>
    </div>
  );
}
