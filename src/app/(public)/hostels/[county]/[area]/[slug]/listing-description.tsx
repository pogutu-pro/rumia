'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ListingDescriptionProps {
  description?: string | null;
}

const COLLAPSE_CHARACTER_LIMIT = 380;
const COLLAPSE_PARAGRAPH_LIMIT = 3;

export function ListingDescription({ description }: ListingDescriptionProps) {
  const paragraphs = useMemo(
    () => (description || '').split('\n').map((para) => para.trim()).filter(Boolean),
    [description]
  );
  const [expanded, setExpanded] = useState(false);

  if (paragraphs.length === 0) return null;

  const shouldCollapse =
    paragraphs.join(' ').length > COLLAPSE_CHARACTER_LIMIT ||
    paragraphs.length > COLLAPSE_PARAGRAPH_LIMIT;

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          className={cn(
            'space-y-3 text-sm font-medium leading-relaxed text-slate-600 sm:text-base',
            shouldCollapse && !expanded && 'max-h-44 overflow-hidden sm:max-h-none'
          )}
        >
          {paragraphs.map((para, idx) => (
            <p key={idx} className="flex items-start gap-2">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>{para}</span>
            </p>
          ))}
        </div>

        {shouldCollapse && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-white/0 to-white sm:hidden" />
        )}
      </div>

      {shouldCollapse && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 sm:hidden"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
