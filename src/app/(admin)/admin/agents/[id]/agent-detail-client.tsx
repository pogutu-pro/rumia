'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import {
  updateListingActiveAction,
  markCommissionPaidAction,
  updateUserRoleAction,
  toggleAgentVerifiedAction,
  updateAgentStatusAction,
} from '@/app/actions/admin';
import { EditAgentSheet } from './edit-agent-sheet';

interface AgentDetailClientProps {
  agent: {
    id: string;
    name: string;
    phone: string;
    whatsapp: string;
    status: string;
    suspension_reason?: string | null;
    verified: boolean;
    created_at: string;
    user_id?: string;
    role?: 'student' | 'agent' | 'manager' | 'admin';
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

  const [promoting, setPromoting] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [verified, setVerified] = useState(agent.verified);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [statusPending, setStatusPending] = useState(false);

  async function handleToggleVerified() {
    const newVerified = !verified;
    const result = await toggleAgentVerifiedAction(agent.id, newVerified);
    if (result.success) {
      setVerified(newVerified);
      toast.success(newVerified ? 'Agent verified' : 'Agent verification removed');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleToggleRole() {
    if (!agent.user_id) return;
    if (agent.role !== 'manager') return;
    const confirmed = window.confirm('Demote this user to agent? They will lose manager access.');
    if (!confirmed) return;
    setPromoting(true);
    const result = await updateUserRoleAction(agent.user_id, 'agent');
    setPromoting(false);
    if (result.success) { toast.success('User demoted to agent'); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function handleSuspend() {
    if (!suspensionReason.trim()) {
      toast.error('Please provide a suspension reason.');
      return;
    }
    setStatusPending(true);
    const result = await updateAgentStatusAction(agent.id, 'suspended', suspensionReason.trim());
    setStatusPending(false);
    if (result.success) {
      toast.success('Agent suspended');
      setSuspendModalOpen(false);
      setSuspensionReason('');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleReactivate() {
    setStatusPending(true);
    const result = await updateAgentStatusAction(agent.id, 'active');
    setStatusPending(false);
    if (result.success) { toast.success('Agent reactivated'); router.refresh(); }
    else { toast.error(result.error); }
  }

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
      {/* Suspend Modal */}
      {suspendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Suspend agent?</h2>
            <p className="text-sm text-slate-600">
              Provide a reason. The agent will see this and cannot post hostels until reinstated.
            </p>
            <textarea
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="e.g. Fraudulent listing reported by students..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setSuspendModalOpen(false); setSuspensionReason(''); }}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={statusPending || !suspensionReason.trim()}
                onClick={handleSuspend}
                className="text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {statusPending ? 'Suspending...' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{agent.name}</h1>
            <button
              onClick={() => setEditSheetOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Edit agent details"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap self-start">
            {agent.role === 'admin' ? (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-purple-50 text-purple-700">Admin</span>
            ) : agent.role === 'manager' ? (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-indigo-50 text-indigo-700">Manager</span>
            ) : (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-blue-50 text-blue-700">Agent</span>
            )}
            {agent.status === 'active' ? (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">Active</span>
            ) : (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-rose-100 text-rose-700">Suspended</span>
            )}
            {verified ? (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-green-50 text-green-700">Verified</span>
            ) : (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-500">Not Verified</span>
            )}
            <button
              onClick={handleToggleVerified}
              className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                verified
                  ? 'border-green-200 text-green-700 hover:bg-green-50'
                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {verified ? 'Remove Verification' : 'Verify Agent'}
            </button>
            {agent.status === 'active' ? (
              <button
                disabled={statusPending}
                onClick={() => setSuspendModalOpen(true)}
                className="text-xs font-medium px-3 py-1 rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
              >
                Suspend
              </button>
            ) : (
              <button
                disabled={statusPending}
                onClick={handleReactivate}
                className="text-xs font-medium px-3 py-1 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                {statusPending ? '...' : 'Reactivate'}
              </button>
            )}
            {agent.user_id && agent.role === 'manager' && (
              <button
                onClick={handleToggleRole}
                disabled={promoting}
                className="text-xs font-medium px-3 py-1 rounded-full border transition-colors disabled:opacity-50 border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                {promoting ? '...' : 'Demote to Agent'}
              </button>
            )}
          </div>
        </div>

        {/* Suspension reason display */}
        {agent.status === 'suspended' && agent.suspension_reason && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-800">
            <span className="font-semibold">Suspension reason: </span>{agent.suspension_reason}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Phone', value: agent.phone },
            { label: 'WhatsApp', value: agent.whatsapp },
            { label: 'Join Date', value: new Date(agent.created_at).toLocaleDateString() },
            { label: 'ID', value: agent.id.slice(0, 8) + '...' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-sm font-medium text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200/80">
          <h2 className="text-sm font-semibold text-slate-900">Listings ({listings.length})</h2>
        </div>
        {listings.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No listings for this agent.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4 sm:p-5">
            {listings.map((listing) => (
              <div key={listing.id} className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50">
                <h3 className="text-sm font-semibold text-slate-900 mb-1 leading-snug">{listing.title}</h3>
                <p className="text-xs text-slate-500 mb-1">{listing.location}</p>
                <p className="text-sm font-semibold text-slate-800 mb-3">KES {listing.price.toLocaleString()}</p>
                <div className="flex items-center justify-between">
                  {listing.is_active ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Inactive</span>
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
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200/80">
          <h2 className="text-sm font-semibold text-slate-900">Leads ({sortedLeads.length})</h2>
        </div>
        {sortedLeads.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No leads attributed to this agent.</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-3 text-left">Date</th><th className="px-5 py-3 text-left">Time</th><th className="px-5 py-3 text-left">Listing Name</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="text-sm text-slate-600 px-5 py-3">{new Date(lead.clicked_at).toLocaleDateString()}</td>
                      <td className="text-sm text-slate-600 px-5 py-3">{new Date(lead.clicked_at).toLocaleTimeString()}</td>
                      <td className="text-sm text-slate-600 px-5 py-3">{lead.listings?.title ?? 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-50">
              {sortedLeads.map((lead) => (
                <div key={lead.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-900">{lead.listings?.title ?? 'Unknown'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(lead.clicked_at).toLocaleDateString()} at {new Date(lead.clicked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Commissions */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200/80">
          <h2 className="text-sm font-semibold text-slate-900">Commissions ({commissions.length})</h2>
        </div>
        {commissions.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No commission records.</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-3 text-left">Listing</th><th className="px-5 py-3 text-left">Amount (KES)</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-left">Created</th><th className="px-5 py-3 text-left">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {commissions.map((commission) => (
                    <tr key={commission.id} className="hover:bg-slate-50">
                      <td className="text-sm text-slate-700 px-5 py-3">{commission.listings?.title ?? 'Unknown'}</td>
                      <td className="text-sm text-slate-700 px-5 py-3 font-medium">{commission.amount.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        {commission.status === 'paid' ? (
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Paid</span>
                        ) : (
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending</span>
                        )}
                      </td>
                      <td className="text-sm text-slate-500 px-5 py-3">{new Date(commission.created_at).toLocaleDateString()}</td>
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
            <div className="md:hidden divide-y divide-slate-50">
              {commissions.map((commission) => (
                <div key={commission.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-slate-900">{commission.listings?.title ?? 'Unknown'}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${commission.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {commission.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">KES {commission.amount.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{new Date(commission.created_at).toLocaleDateString()}</p>
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

      <EditAgentSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        agent={{ id: agent.id, name: agent.name, phone: agent.phone, whatsapp: agent.whatsapp }}
      />
    </div>
  );
}
