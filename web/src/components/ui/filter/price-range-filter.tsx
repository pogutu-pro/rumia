'use client';

import { useState, useCallback } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/currency';

const MIN_PRICE = 1000;
const MAX_PRICE = 30000;
const STEP = 500;

const PRESETS = [
  { label: 'Under KES 3,000', min: null, max: 3000 },
  { label: 'Under KES 4,000', min: null, max: 4000 },
  { label: 'Under KES 5,000', min: null, max: 5000 },
  { label: 'Under KES 6,000', min: null, max: 6000 },
  { label: 'Under KES 8,000', min: null, max: 8000 },
  { label: 'Under KES 10,000', min: null, max: 10000 },
  { label: 'Above KES 10,000', min: 10000, max: null },
];

interface PriceRangeFilterProps {
  minPrice: number | null;
  maxPrice: number | null;
  onChange: (min: number | null, max: number | null) => void;
}

export function PriceRangeFilter({ minPrice, maxPrice, onChange }: PriceRangeFilterProps) {
  const [localMin, setLocalMin] = useState(minPrice ?? MIN_PRICE);
  const [localMax, setLocalMax] = useState(maxPrice ?? MAX_PRICE);
  const [minInput, setMinInput] = useState(String(minPrice ?? ''));
  const [maxInput, setMaxInput] = useState(String(maxPrice ?? ''));
  const [prevMin, setPrevMin] = useState(minPrice ?? MIN_PRICE);
  const [prevMax, setPrevMax] = useState(maxPrice ?? MAX_PRICE);

  // Sync when the parent updates the committed price range.
  if ((minPrice ?? MIN_PRICE) !== prevMin || (maxPrice ?? MAX_PRICE) !== prevMax) {
    setPrevMin(minPrice ?? MIN_PRICE);
    setPrevMax(maxPrice ?? MAX_PRICE);
    setLocalMin(minPrice ?? MIN_PRICE);
    setLocalMax(maxPrice ?? MAX_PRICE);
    setMinInput(minPrice ? String(minPrice) : '');
    setMaxInput(maxPrice ? String(maxPrice) : '');
  }

  const commitRange = useCallback(
    (min: number, max: number) => {
      const mn = min <= MIN_PRICE ? null : min;
      const mx = max >= MAX_PRICE ? null : max;
      onChange(mn, mx);
      setMinInput(mn ? String(mn) : '');
      setMaxInput(mx ? String(mx) : '');
    },
    [onChange],
  );

  const handleSliderChange = (values: number[]) => {
    setLocalMin(values[0]);
    setLocalMax(values[1]);
    setMinInput(String(values[0]));
    setMaxInput(String(values[1]));
  };

  const handleSliderCommit = (values: number[]) => {
    commitRange(values[0], values[1]);
  };

  const handleMinBlur = () => {
    const val = parseInt(minInput, 10);
    if (!isNaN(val) && val >= MIN_PRICE && val < localMax) {
      setLocalMin(val);
      commitRange(val, localMax);
    } else {
      setMinInput(String(localMin));
    }
  };

  const handleMaxBlur = () => {
    const val = parseInt(maxInput, 10);
    if (!isNaN(val) && val <= MAX_PRICE && val > localMin) {
      setLocalMax(val);
      commitRange(localMin, val);
    } else {
      setMaxInput(String(localMax));
    }
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-semibold text-slate-900">Price Range</label>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
            KSh
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            onBlur={handleMinBlur}
            placeholder="Min"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-text"
          />
        </div>
        <span className="text-slate-300 text-sm font-medium">—</span>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
            KSh
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            onBlur={handleMaxBlur}
            placeholder="Max"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-text"
          />
        </div>
      </div>

      <div className="px-1">
        <SliderPrimitive.Root
          value={[localMin, localMax]}
          min={MIN_PRICE}
          max={MAX_PRICE}
          step={STEP}
          onValueChange={handleSliderChange}
          onValueCommit={handleSliderCommit}
          className="relative flex h-6 w-full touch-none select-none items-center"
        >
          <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-slate-200">
            <SliderPrimitive.Range className="absolute h-full rounded-full bg-emerald-500" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-5 w-5 cursor-grab rounded-full border-2 border-emerald-500 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 active:cursor-grabbing" />
          <SliderPrimitive.Thumb className="block h-5 w-5 cursor-grab rounded-full border-2 border-emerald-500 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 active:cursor-grabbing" />
        </SliderPrimitive.Root>

        <div className="mt-1 flex justify-between text-xs font-medium text-slate-400">
          <span>{formatCurrency(MIN_PRICE)}</span>
          <span>{formatCurrency(MAX_PRICE)}</span>
        </div>
      </div>

      {(minPrice || maxPrice) && (
        <p className="text-center text-sm font-semibold text-emerald-600">
          {formatCurrency(minPrice ?? MIN_PRICE)} – {formatCurrency(maxPrice ?? MAX_PRICE)}
        </p>
      )}

      <div className="space-y-2 pt-2 border-t border-slate-100">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Presets</span>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => {
            const isActive = minPrice === preset.min && maxPrice === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(preset.min, preset.max)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-xs font-medium transition-all text-center cursor-pointer',
                  isActive
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

