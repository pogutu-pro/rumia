'use client';

import { Commission, Listing } from '@/types';

interface CommissionTableProps {
  commissions: Commission[];
  listings: Listing[];
  leadsCountByListing: Record<string, number>;
}

export function CommissionTable({ commissions, listings, leadsCountByListing }: CommissionTableProps) {
  if (commissions.length === 0) {
    return (
      <div className="bg-raised rounded-2xl border border-line p-8 text-center shadow-xs">
        <p className="text-ink-muted font-semibold">No commission records found.</p>
      </div>
    );
  }

  return (
    <div className="bg-raised rounded-2xl border border-line overflow-hidden shadow-xs">
      {/* Mobile card list */}
      <ul className="divide-y divide-line md:hidden">
        {commissions.map((commission) => {
          const listing = listings.find((l) => l.id === commission.listing_id);
          return (
            <li key={commission.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink text-sm truncate">
                  {listing ? listing.title : 'Unknown Listing'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {commission.status === 'paid' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-primary border border-emerald-100">Paid</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">Pending</span>
                  )}
                  <span className="text-xs text-ink-muted">{leadsCountByListing[String(commission.listing_id)] || 0} leads</span>
                </div>
              </div>
              <span className="font-black text-ink text-sm shrink-0">
                KES {commission.amount.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-subtle border-b border-line text-ink-muted font-bold uppercase tracking-wider text-xs">
            <tr>
              <th className="px-6 py-4">Listing</th>
              <th className="px-6 py-4">Leads</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {commissions.map((commission) => {
              const listing = listings.find((l) => l.id === commission.listing_id);
              const leadsCount = leadsCountByListing[String(commission.listing_id)] || 0;
              return (
                <tr key={commission.id} className="hover:bg-subtle transition-colors">
                  <td className="px-6 py-4 font-bold text-ink">
                    {listing ? listing.title : 'Unknown Listing'}
                  </td>
                  <td className="px-6 py-4 text-ink-muted font-medium">{leadsCount}</td>
                  <td className="px-6 py-4">
                    {commission.status === 'paid' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-primary border border-emerald-100">Paid</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-ink">
                    KES {commission.amount.toLocaleString()}
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
