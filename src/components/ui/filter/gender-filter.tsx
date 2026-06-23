'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'mixed', label: 'Mixed' },
];

interface GenderFilterProps {
  selected: string[];
  onChange: (values: string[]) => void;
}

export function GenderFilter({ selected, onChange }: GenderFilterProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-900">Gender Policy</label>
      <div className="space-y-1">
        {GENDER_OPTIONS.map((option) => {
          const isActive = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="checkbox"
              aria-checked={isActive}
              onClick={() => toggle(option.value)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200',
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
  );
}
