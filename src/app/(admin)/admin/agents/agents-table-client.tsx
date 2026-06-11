'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateAgentStatusAction, updateUserRoleAction } from '@/app/actions/admin';
import type { AdminAgent } from '@/types';
import { AddAgentSheet } from './add-agent-sheet';

interface AgentsTableClientProps {
  agents: AdminAgent[];
}

export function AgentsTableClient({ agents }: AgentsTableClientProps) {
  const router = useRouter();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);

  async function handleSuspend(agentId: string) {
    const confirmed = window.confirm('Are you sure you want to suspend this agent?');
    if (!confirmed) return;
    setPendingAgentId(agentId);
    const result = await updateAgentStatusAction(agentId, 'suspended');
    setPendingAgentId(null);
    if (result.success) { toast.success('Agent suspended'); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function handleActivate(agentId: string) {
    setPendingAgentId(agentId);
    const result = await updateAgentStatusAction(agentId, 'active');
    setPendingAgentId(null);
    if (result.success) { toast.success('Agent activated'); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function handlePromoteToAdmin(userId: string, agentId: string) {
    const confirmed = window.confirm('Promote this user to admin? They will gain access to the admin dashboard.');
    if (!confirmed) return;
    setPendingRoleId(agentId);
    const result = await updateUserRoleAction(userId, 'admin');
    setPendingRoleId(null);
    if (result.success) { toast.success('User promoted to admin'); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function handleDemoteToAgent(userId: string, agentId: string) {
    const confirmed = window.confirm('Demote this user to agent? They will lose access to the admin dashboard.');
    if (!confirmed) return;
    setPendingRoleId(agentId);
    const result = await updateUserRoleAction(userId, 'agent');
    setPendingRoleId(null);
    if (result.success) { toast.success('User demoted to agent'); router.refresh(); }
    else { toast.error(result.error); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500 mt-1">{agents.length} agent{agents.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button onClick={() => setAddSheetOpen(true)} className="rounded-xl">Add Agent</Button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Name', 'Phone / WhatsApp', 'Active Listings', 'Total Leads', 'Commission Pending (KES)', 'Role', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {agents.length === 0 ? (
              <tr><td colSpan={8} className="text-sm text-gray-400 text-center px-5 py-8">No agents registered.</td></tr>
            ) : agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                <td className="text-sm px-5 py-4">
                  <Link href={`/admin/agents/${agent.id}`} className="font-medium text-gray-900 hover:text-emerald-600">{agent.name}</Link>
                </td>
                <td className="text-sm text-gray-600 px-5 py-4">
                  <div>{agent.phone}</div>
                  {agent.whatsapp && agent.whatsapp !== agent.phone && <div className="text-gray-400 text-xs">{agent.whatsapp}</div>}
                </td>
                <td className="text-sm text-gray-600 px-5 py-4">{agent.active_listings_count ?? 0}</td>
                <td className="text-sm text-gray-600 px-5 py-4">{agent.total_leads_count ?? 0}</td>
                <td className="text-sm text-gray-600 px-5 py-4">{(agent.pending_commissions_sum ?? 0).toLocaleString()}</td>
                <td className="px-5 py-4">
                  {agent.role === 'admin' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700">Admin</span>
                      <button
                        onClick={() => handleDemoteToAgent(agent.user_id, agent.id)}
                        disabled={pendingRoleId === agent.id}
                        className="text-xs text-amber-600 hover:underline disabled:opacity-50"
                      >
                        {pendingRoleId === agent.id ? '...' : 'Demote'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">Agent</span>
                      <button
                        onClick={() => handlePromoteToAdmin(agent.user_id, agent.id)}
                        disabled={pendingRoleId === agent.id}
                        className="text-xs text-purple-600 hover:underline disabled:opacity-50"
                      >
                        {pendingRoleId === agent.id ? '...' : 'Promote'}
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-5 py-4">
                  {agent.status === 'active' ? (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">Suspended</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Link href={`/admin/agents/${agent.id}`} className="text-emerald-600 hover:underline font-medium">View</Link>
                    {agent.status === 'active' ? (
                      <button onClick={() => handleSuspend(agent.id)} disabled={pendingAgentId === agent.id} className="text-red-500 hover:underline disabled:opacity-50">
                        {pendingAgentId === agent.id ? '...' : 'Suspend'}
                      </button>
                    ) : (
                      <button onClick={() => handleActivate(agent.id)} disabled={pendingAgentId === agent.id} className="text-emerald-600 hover:underline disabled:opacity-50">
                        {pendingAgentId === agent.id ? '...' : 'Activate'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {agents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5 text-center text-sm text-gray-400 shadow-sm">No agents registered.</div>
        ) : agents.map((agent) => (
          <div key={agent.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <Link href={`/admin/agents/${agent.id}`} className="text-sm font-semibold text-gray-900 hover:text-emerald-600">{agent.name}</Link>
                <p className="text-xs text-gray-400 mt-0.5">{agent.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                {agent.role === 'admin' ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Admin</span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Agent</span>
                )}
                {agent.status === 'active' ? (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
                ) : (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">Suspended</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-400">Listings</p>
                <p className="text-sm font-semibold text-gray-900">{agent.active_listings_count ?? 0}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-400">Leads</p>
                <p className="text-sm font-semibold text-gray-900">{agent.total_leads_count ?? 0}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-400">Commission</p>
                <p className="text-sm font-semibold text-gray-900">{(agent.pending_commissions_sum ?? 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <Link href={`/admin/agents/${agent.id}`} className="text-xs font-medium text-emerald-600 hover:underline">View Profile</Link>
              {agent.role === 'admin' ? (
                <button onClick={() => handleDemoteToAgent(agent.user_id, agent.id)} disabled={pendingRoleId === agent.id} className="text-xs font-medium text-amber-600 hover:underline disabled:opacity-50">
                  {pendingRoleId === agent.id ? '...' : 'Demote to Agent'}
                </button>
              ) : (
                <button onClick={() => handlePromoteToAdmin(agent.user_id, agent.id)} disabled={pendingRoleId === agent.id} className="text-xs font-medium text-purple-600 hover:underline disabled:opacity-50">
                  {pendingRoleId === agent.id ? '...' : 'Promote to Admin'}
                </button>
              )}
              {agent.status === 'active' ? (
                <button onClick={() => handleSuspend(agent.id)} disabled={pendingAgentId === agent.id} className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50">
                  {pendingAgentId === agent.id ? 'Suspending...' : 'Suspend'}
                </button>
              ) : (
                <button onClick={() => handleActivate(agent.id)} disabled={pendingAgentId === agent.id} className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50">
                  {pendingAgentId === agent.id ? 'Activating...' : 'Activate'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AddAgentSheet open={addSheetOpen} onOpenChange={setAddSheetOpen} />
    </div>
  );
}
