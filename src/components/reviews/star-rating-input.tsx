'use client';

import { useState } from 'react';
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
  // Hover preview (desktop only): shows which rating a click would apply
  // without changing the committed value until the user taps/click.
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => !disabled && setHovered(star)}
          onFocus={() => !disabled && setHovered(star)}
          className={cn(
            'rounded-md p-1 sm:p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            !disabled && 'hover:scale-105 active:scale-95',
            disabled && 'cursor-not-allowed',
          )}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          aria-checked={value >= star}
          role="radio"
        >
          <Star
            className={cn(
              sizeClasses[size],
              active >= star
                ? 'fill-amber-400 text-amber-400'
                : 'fill-slate-200 text-slate-200',
            )}
          />
        </button>
      ))}
    </div>
  );
}
