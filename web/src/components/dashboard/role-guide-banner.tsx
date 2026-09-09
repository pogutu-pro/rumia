'use client';

import { useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';

type RoleGuideBannerProps = {
  title: string;
  description: string;
  checklist: string[];
  storageKey: string;
  icon?: ReactNode;
};

export function RoleGuideBanner({
  title,
  description,
  checklist,
  storageKey,
  icon,
}: RoleGuideBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  // Returns true only after hydration, so the localStorage read never runs on
  // the server or during the SSR-matching hydration render.
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isVisible =
    isReady && !dismissed && window.localStorage.getItem(storageKey) !== 'true';

  const handleDismiss = () => {
    window.localStorage.setItem(storageKey, 'true');
    setDismissed(true);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            {icon ?? <CheckCircle2 className="h-4 w-4" />}
          </div>
          <div className="space-y-2.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            </div>
            <ul className="space-y-1.5">
              {checklist.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
        >
          <span className="mr-1.5">I understand</span>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
