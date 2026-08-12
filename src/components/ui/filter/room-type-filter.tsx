'use client';

import { cn } from '@/lib/utils/cn';
import { motion } from 'framer-motion';

const ROOM_TYPE_OPTIONS = [
  { value: 'bedsitter', label: 'Bedsitter' },
  { value: 'self_contained', label: 'One Bedroom' },
  { value: 'single', label: 'Single Room' },
];

interface RoomTypeFilterProps {
  selected: string[];
  onChange: (values: string[]) => void;
}

export function RoomTypeFilter({ selected, onChange }: RoomTypeFilterProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-900">Room Type</label>
      <div className="flex flex-wrap gap-2">
        {ROOM_TYPE_OPTIONS.map((option) => {
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
