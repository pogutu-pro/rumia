import { Search, X } from 'lucide-react';

interface ListingSearchInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
}

/**
 * The shared search input used on the /hostels search page and the Home
 * Explore feed. Renders only the input block; pages wrap it in the elevated
 * white zone so sizing/positioning stay identical.
 */
export function ListingSearchInput({
  value,
  placeholder = 'Search by name, area, or price',
  onChange,
  onClear,
  onKeyDown,
  onBlur,
}: ListingSearchInputProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-100/60 pl-10 pr-10 text-[15px] font-medium text-slate-900 transition-all duration-200 placeholder:text-slate-500 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 lg:h-[50px]"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}