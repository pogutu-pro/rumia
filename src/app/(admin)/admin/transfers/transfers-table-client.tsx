'use client';

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TransferRow {
  id: string;
  listing_id: string;
  listing_title: string;
  previous_owner_name: string;
  new_owner_name: string;
  transferred_at: string;
  previous_owner_id: string;
  new_owner_id: string;
  transferred_by: string;
}

interface TransfersTableClientProps {
  transfers: TransferRow[];
}

const PAGE_SIZE = 20;

export function TransfersTableClient({ transfers }: TransfersTableClientProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visible = transfers.slice(0, visibleCount);
  const hasMore = transfers.length > visibleCount;

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Transfer History</h1>
        <ArrowLeftRight className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500 mb-6">{transfers.length} transfer{transfers.length !== 1 ? 's' : ''}</p>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50">
              {['Hostel', 'Previous Owner', 'New Owner', 'Transferred At'].map((h) => (
                <th key={h} className="text-xs font-medium text-slate-500 uppercase tracking-wider text-left px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {transfers.length === 0 ? (
              <tr><td colSpan={4} className="text-sm text-slate-400 text-center px-5 py-8">No transfers recorded yet.</td></tr>
            ) : visible.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4 text-sm font-medium text-slate-900">{t.listing_title}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{t.previous_owner_name}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{t.new_owner_name}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{new Date(t.transferred_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {transfers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 text-center text-sm text-slate-400 shadow-sm">No transfers recorded yet.</div>
        ) : visible.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">{t.listing_title}</h3>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{t.previous_owner_name}</span>
              <ArrowLeftRight className="h-3 w-3 text-slate-400" />
              <span>{t.new_owner_name}</span>
            </div>
            <p className="text-xs text-slate-400">{new Date(t.transferred_at).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="rounded-xl">Load More</Button>
        </div>
      )}
    </div>
  );
}
