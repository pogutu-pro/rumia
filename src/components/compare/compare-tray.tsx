'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitCompareArrows, Trash2, X } from 'lucide-react';
import { useCompareStore } from '@/stores/compare-store';
import { cn } from '@/lib/utils/cn';

export function CompareTray() {
  const pathname = usePathname();
  const selectedIds = useCompareStore((s) => s.selectedIds);
  const selections = useCompareStore((s) => s.selections);
  const clearSelection = useCompareStore((s) => s.clearSelection);
  const removeSelection = useCompareStore((s) => s.removeSelection);

  const count = selectedIds.length;
  if (count === 0 || pathname === '/compare') return null;

  const names = selectedIds
    .map((id) => selections[id]?.title)
    .filter(Boolean) as string[];

  const canCompare = count >= 2;

  // ── Mobile: above bottom nav ────────────────────────────────────────────
  const mobileTray = (
    <div
      className="fixed left-0 right-0 z-50 px-3 md:hidden pointer-events-none"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="pointer-events-auto bg-white rounded-2xl border border-slate-200/80 shadow-[0_-4px_24px_rgba(0,0,0,0.10)] px-4 py-3">
        {/* Selected names */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <GitCompareArrows className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            {names.length === 1 ? (
              <>
                <p className="text-sm font-bold text-slate-900 truncate leading-tight">
                  {names[0]}
                </p>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                  Select one more to compare
                </p>
              </>
            ) : (
              <div className="space-y-0.5">
                {names.slice(0, 2).map((name) => (
                  <p key={name} className="text-sm font-bold text-slate-900 truncate leading-tight">
                    {name}
                  </p>
                ))}
                {names.length > 2 && (
                  <p className="text-xs text-slate-400 font-medium">
                    +{names.length - 2} more
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            aria-label="Clear comparison"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {selectedIds.map((id) => {
            const s = selections[id];
            if (!s) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => removeSelection(id)}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer max-w-[45%] truncate"
                aria-label={`Remove ${s.title}`}
              >
                <span className="truncate">{s.title}</span>
                <X className="h-2.5 w-2.5 shrink-0" />
              </button>
            );
          })}
        </div>

        <Link
          href="/compare"
          className={cn(
            'mt-3 flex items-center justify-center gap-2 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200',
            canCompare
              ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-700 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 pointer-events-none',
          )}
        >
          <GitCompareArrows className="h-4 w-4" />
          Compare Now
        </Link>
      </div>
    </div>
  );

  // ── Desktop: left sidebar panel ──────────────────────────────────────────
  const desktopTray = (
    <div className="hidden md:block fixed top-24 left-4 z-40 w-64 pointer-events-none">
      <div className="pointer-events-auto bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <GitCompareArrows className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Compare
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              {count} selected
            </p>
          </div>
        </div>

        {/* Selected hostel names */}
        <div className="space-y-1.5">
          {names.map((name, i) => (
            <div
              key={selectedIds[i]}
              className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
            >
              <span className="text-[11px] font-bold text-slate-400 tabular-nums w-4">
                {i + 1}.
              </span>
              <span className="text-xs font-semibold text-slate-700 truncate flex-1">
                {name}
              </span>
              <button
                type="button"
                onClick={() => removeSelection(selectedIds[i])}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
                aria-label={`Remove ${name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 4 - count) }).map(
          (_, i) => (
            <div
              key={`empty-${i}`}
              className={cn(
                'flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5',
                i >= 2 && 'hidden md:flex',
              )}
            >
              <span className="text-[11px] font-bold text-slate-300 tabular-nums w-4">
                {count + i + 1}.
              </span>
              <span className="text-xs text-slate-300 font-medium italic">
                Add a hostel
              </span>
            </div>
          ),
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearSelection}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </button>
          <Link
            href="/compare"
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200',
              canCompare
                ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-700 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 pointer-events-none',
            )}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare Now
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mobileTray}
      {desktopTray}
    </>
  );
}
