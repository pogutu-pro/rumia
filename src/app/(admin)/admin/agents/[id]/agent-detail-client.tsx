'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  updateListingActiveAction,
  markCommissionPaidAction,
} from '@/app/actions/admin';

interface AgentDetailClientProps {
  agent: {
    id: string;
    name: string;
    phone: string;
    whatsapp: string;
    status: string;
    created_at: string;
  };
  listings: Array<{
    id: string;
    title: string;
    location: string;
    price: number;
    is_active: boolean;
  }>;
  leads: Array<{
    id: string;
    clicked_at: string;
    listings: { id: string; title: string } | null;
  }>;
  commissions: Array<{
    id: string;
    amount: number;
    status: 'pending' | 'paid';
    created_at: string;
    paid_at: string | null;
    listings: { id: string; title: string } | null;
  }>;
}

export function AgentDetailClient({ agent, listings, leads, commissions }: AgentDetailClientProps) {
  const router = useRouter();

  async function handleToggleListing(listingId: string, currentActive: boolean) {
    const result = currentActive
      ? await updateListingActiveAction(listingId, false)
      : await updateListingActiveAction(listingId, true);
    if (result.success) { toast.success(currentActive ? 'Listing deactivated' : 'Listing activated'); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function handleMarkCommissionPaid(commissionId: string) {
    const result = await markCommissionPaidAction(commissionId);
    if (result.success) { toast.success('Commission marked as paid'); router.refresh(); }
    else { toast.error(result.error); }
  }

  const sortedLeads = [...leads].sort((a, b) => new Date(b.clicked_at).getTime() - new Date(a.clicked_at).getTime());

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{agent.name}</h1>
          {agent.status === 'active' ? (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 self-start">Active</span>
          ) : (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600 self-start">Suspended</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Phone', value: agent.phone },
            { label: 'WhatsApp', value: agent.whatsapp },
            { label: 'Join Date', value: new Date(agent.created_at).toLocaleDateString() },
            { label: 'ID', value: agent.id.slice(0, 8) + '...' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-sm font-medium text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Listings ({listings.length})</h2>
        </div>
        {listings.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No listings for this agent.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4 sm:p-5">
            {listings.map((listing) => (
              <div key={listing.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900 mb-1 leading-snug">{listing.title}</h3>
                <p className="text-xs text-gray-500 mb-1">{listing.location}</p>
                <p className="text-sm font-semibold text-gray-800 mb-3">KES {listing.price.toLocaleString()}</p>
                <div className="flex items-center justify-between">
                  {listing.is_active ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Inactive</span>
                  )}
                  <button
                    onClick={() => handleToggleListing(listing.id, listing.is_active)}
                    className={`text-xs font-medium hover:underline ${listing.is_active ? 'text-red-500' : 'text-emerald-600'}`}
                  >
                    {listing.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leads */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Leads ({sortedLeads.length})</h2>
        </div>
        {sortedLeads.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No leads attributed to this agent.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <tr><th className="px-5 py-3 text-left">Date</th><th className="px-5 py-3 text-left">Time</th><th className="px-5 py-3 text-left">Listing Name</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="text-sm text-gray-600 px-5 py-3">{new Date(lead.clicked_at).toLocaleDateString()}</td>
                      <td className="text-sm text-gray-600 px-5 py-3">{new Date(lead.clicked_at).toLocaleTimeString()}</td>
                      <td className="text-sm text-gray-600 px-5 py-3">{lead.listings?.title ?? 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-50">
              {sortedLeads.map((lead) => (
                <div key={lead.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900">{lead.listings?.title ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(lead.clicked_at).toLocaleDateString()} at {new Date(lead.clicked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Commissions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Commissions ({commissions.length})</h2>
        </div>
        {commissions.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No commission records.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <tr><th className="px-5 py-3 text-left">Listing</th><th className="px-5 py-3 text-left">Amount (KES)</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-left">Created</th><th className="px-5 py-3 text-left">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {commissions.map((commission) => (
                    <tr key={commission.id} className="hover:bg-gray-50">
                      <td className="text-sm text-gray-700 px-5 py-3">{commission.listings?.title ?? 'Unknown'}</td>
                      <td className="text-sm text-gray-700 px-5 py-3 font-medium">{commission.amount.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        {commission.status === 'paid' ? (
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Paid</span>
                        ) : (
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending</span>
                        )}
                      </td>
                      <td className="text-sm text-gray-500 px-5 py-3">{new Date(commission.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        {commission.status === 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkCommissionPaid(commission.id)} className="rounded-lg text-xs h-8">Mark Paid</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-50">
              {commissions.map((commission) => (
                <div key={commission.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-gray-900">{commission.listings?.title ?? 'Unknown'}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${commission.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {commission.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">KES {commission.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{new Date(commission.created_at).toLocaleDateString()}</p>
                  </div>
                  {commission.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => handleMarkCommissionPaid(commission.id)} className="rounded-lg text-xs h-8 w-full">Mark as Paid</Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
