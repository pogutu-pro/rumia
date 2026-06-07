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

export function AgentDetailClient({
  agent,
  listings,
  leads,
  commissions,
}: AgentDetailClientProps) {
  const router = useRouter();

  async function handleDeactivateListing(listingId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to deactivate this listing? It will no longer be visible to students.'
    );
    if (!confirmed) return;

    const result = await updateListingActiveAction(listingId, false);
    if (result.success) {
      toast.success('Listing deactivated successfully');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleActivateListing(listingId: string) {
    const result = await updateListingActiveAction(listingId, true);
    if (result.success) {
      toast.success('Listing activated successfully');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleMarkCommissionPaid(commissionId: string) {
    const result = await markCommissionPaidAction(commissionId);
    if (result.success) {
      toast.success('Commission marked as paid');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // Sort leads by clicked_at descending
  const sortedLeads = [...leads].sort(
    (a, b) => new Date(b.clicked_at).getTime() - new Date(a.clicked_at).getTime()
  );

  return (
    <div>
      {/* A) Profile Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h1 className="text-2xl font-semibold mb-4">{agent.name}</h1>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Phone
            </p>
            <p className="text-sm text-gray-900">{agent.phone}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              WhatsApp
            </p>
            <p className="text-sm text-gray-900">{agent.whatsapp}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Join Date
            </p>
            <p className="text-sm text-gray-900">
              {new Date(agent.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Status
            </p>
            {agent.status === 'active' ? (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">
                Active
              </span>
            ) : (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                Suspended
              </span>
            )}
          </div>
        </div>
      </div>

      {/* B) Listings Grid */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Listings</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-gray-500">No listings for this agent.</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  {listing.title}
                </h3>
                <p className="text-sm text-gray-500 mb-1">{listing.location}</p>
                <p className="text-sm text-gray-700 mb-2">
                  KES {listing.price.toLocaleString()}
                </p>
                <div className="flex items-center justify-between">
                  {listing.is_active ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      Inactive
                    </span>
                  )}
                  {listing.is_active ? (
                    <button
                      onClick={() => handleDeactivateListing(listing.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivateListing(listing.id)}
                      className="text-xs text-green-600 hover:underline"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* C) Leads Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Leads</h2>
        {sortedLeads.length === 0 ? (
          <p className="text-sm text-gray-500">No leads attributed to this agent.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-4 py-3">
                  Date
                </th>
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-4 py-3">
                  Time
                </th>
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-4 py-3">
                  Listing Name
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="text-sm text-gray-600 px-4 py-3">
                    {new Date(lead.clicked_at).toLocaleDateString()}
                  </td>
                  <td className="text-sm text-gray-600 px-4 py-3">
                    {new Date(lead.clicked_at).toLocaleTimeString()}
                  </td>
                  <td className="text-sm text-gray-600 px-4 py-3">
                    {lead.listings?.title ?? 'Unknown Listing'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* D) Commissions Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Commissions</h2>
        {commissions.length === 0 ? (
          <p className="text-sm text-gray-500">No commission records.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-4 py-3">
                  Listing Name
                </th>
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-4 py-3">
                  Amount (KES)
                </th>
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-4 py-3">
                  Status
                </th>
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-4 py-3">
                  Date Created
                </th>
                <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commissions.map((commission) => (
                <tr
                  key={commission.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="text-sm text-gray-600 px-4 py-3">
                    {commission.listings?.title ?? 'Unknown Listing'}
                  </td>
                  <td className="text-sm text-gray-600 px-4 py-3">
                    {commission.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {commission.status === 'paid' ? (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">
                        Paid
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="text-sm text-gray-600 px-4 py-3">
                    {new Date(commission.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {commission.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkCommissionPaid(commission.id)}
                      >
                        Mark Commission Paid
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
