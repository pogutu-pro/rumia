'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function StarRatingInput({
  value,
  onChange,
  size = 'md',
  disabled = false,
}: StarRatingInputProps) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cn(
            'rounded-md p-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            !disabled && 'hover:scale-110 active:scale-95',
            disabled && 'cursor-not-allowed',
          )}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          aria-checked={value >= star}
          role="radio"
        >
          <Star
            className={cn(
              sizeClasses[size],
              value >= star
                ? 'fill-amber-400 text-amber-400'
                : 'fill-slate-200 text-slate-200',
            )}
          />
        </button>
      ))}
    </div>
  );
}
