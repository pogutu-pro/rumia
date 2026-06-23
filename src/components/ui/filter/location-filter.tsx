'use client';

import { cn } from '@/lib/utils/cn';
import { motion } from 'framer-motion';

const ZONE_OPTIONS = [
  { value: 'Near Gate A', label: 'Gate A' },
  { value: 'Near Gate B', label: 'Gate B' },
  { value: 'Boma', label: 'Boma' },
  { value: 'Nyeri View', label: 'Nyeri View' },
  { value: 'Kahawa Ridge', label: 'Kahawa Ridge' },
  { value: 'Embassy Area', label: 'Embassy Area' },
  { value: 'Nyaribo', label: 'Nyaribo' },
];

interface LocationFilterProps {
  selected: string[];
  onChange: (values: string[]) => void;
}

export function LocationFilter({ selected, onChange }: LocationFilterProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-900">Location (DeKUT Zones)</label>
      <div className="flex flex-wrap gap-2">
        {ZONE_OPTIONS.map((option) => {
          const isActive = selected.includes(option.value);
          return (
            <motion.button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer',
                isActive
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {option.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
