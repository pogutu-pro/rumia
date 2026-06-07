'use client';

import { Lead, Listing } from '@/types';
import { format } from 'date-fns';

interface LeadsTableProps {
  leads: Lead[];
  listings: Listing[];
}

export function LeadsTable({ leads, listings }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-xs">
        <p className="text-slate-400 font-semibold">No leads yet. Make sure your listings are active and attractive!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
      {/* Mobile card list */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {leads.map((lead) => {
          const listing = listings.find((l) => l.id === lead.listing_id);
          const date = new Date(lead.clicked_at);
          return (
            <li key={lead.id} className="px-4 py-3 flex flex-col gap-0.5">
              <span className="font-bold text-slate-900 text-sm truncate">
                {listing ? listing.title : 'Unknown Listing'}
              </span>
              <span className="text-xs text-slate-500">
                {format(date, 'd MMM yyyy')} · {format(date, 'h:mm a')}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-xs">
            <tr>
              <th className="px-6 py-4">Listing</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const listing = listings.find((l) => l.id === lead.listing_id);
              const date = new Date(lead.clicked_at);
              return (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {listing ? listing.title : 'Unknown Listing'}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {format(date, 'd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {format(date, 'h:mm a')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
