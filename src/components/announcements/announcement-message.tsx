'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AnnouncementMessageProps {
  message: string;
}

/**
 * Tiny interactive expander for long announcement messages. Deliberately small:
 * no libraries, no fetching, no effects — just local expand/collapse state so
 * long notices stay readable without pushing the search experience down.
 */
export function AnnouncementMessage({ message }: AnnouncementMessageProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p
        className={`text-sm text-slate-600 leading-relaxed ${
          expanded ? '' : 'line-clamp-2'
        }`}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-1.5 inline-flex items-center gap-0.5 rounded-md px-1 -ml-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
      >
        {expanded ? 'Show less' : 'Read more'}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
    </div>
  );
}
