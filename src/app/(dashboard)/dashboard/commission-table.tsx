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
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-xs">
        <p className="text-slate-400 font-semibold">No commission records found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-xs">
            <tr>
              <th className="px-6 py-4">Listing</th>
              <th className="px-6 py-4">Leads</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {commissions.map((commission) => {
              const listing = listings.find((l) => l.id === commission.listing_id);
              const leadsCount = leadsCountByListing[String(commission.listing_id)] || 0;
              
              return (
                <tr key={commission.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {listing ? listing.title : 'Unknown Listing'}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    {leadsCount}
                  </td>
                  <td className="px-6 py-4">
                    {commission.status === 'paid' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900">
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
