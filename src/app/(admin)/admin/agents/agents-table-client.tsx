'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateAgentStatusAction } from '@/app/actions/admin';
import type { AdminAgent } from '@/types';
import { AddAgentSheet } from './add-agent-sheet';

interface AgentsTableClientProps {
  agents: AdminAgent[];
}

export function AgentsTableClient({ agents }: AgentsTableClientProps) {
  const router = useRouter();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);

  async function handleSuspend(agentId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to suspend this agent? They will lose access to their dashboard.'
    );
    if (!confirmed) return;

    setPendingAgentId(agentId);
    const result = await updateAgentStatusAction(agentId, 'suspended');
    setPendingAgentId(null);

    if (result.success) {
      toast.success('Agent suspended successfully');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleActivate(agentId: string) {
    setPendingAgentId(agentId);
    const result = await updateAgentStatusAction(agentId, 'active');
    setPendingAgentId(null);

    if (result.success) {
      toast.success('Agent activated successfully');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Agents</h1>
        <Button onClick={() => setAddSheetOpen(true)}>Add Agent</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Name
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Phone / WhatsApp
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Active Listings
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Total Leads
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Commission Pending (KES)
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Status
              </th>
              <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left px-6 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {agents.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-sm text-gray-500 text-center px-6 py-8"
                >
                  No agents registered.
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr
                  key={agent.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Name */}
                  <td className="text-sm px-6 py-4">
                    <Link
                      href={`/admin/agents/${agent.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                    >
                      {agent.name}
                    </Link>
                  </td>

                  {/* Phone / WhatsApp */}
                  <td className="text-sm text-gray-600 px-6 py-4">
                    <div>{agent.phone}</div>
                    {agent.whatsapp && agent.whatsapp !== agent.phone && (
                      <div className="text-gray-400 text-xs">{agent.whatsapp}</div>
                    )}
                  </td>

                  {/* Active Listings */}
                  <td className="text-sm text-gray-600 px-6 py-4">
                    {agent.active_listings_count ?? 0}
                  </td>

                  {/* Total Leads */}
                  <td className="text-sm text-gray-600 px-6 py-4">
                    {agent.total_leads_count ?? 0}
                  </td>

                  {/* Commission Pending */}
                  <td className="text-sm text-gray-600 px-6 py-4">
                    {(agent.pending_commissions_sum ?? 0).toLocaleString()}
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4">
                    {agent.status === 'active' ? (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        Suspended
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/agents/${agent.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Profile
                      </Link>
                      {agent.status === 'active' ? (
                        <button
                          onClick={() => handleSuspend(agent.id)}
                          disabled={pendingAgentId === agent.id}
                          className="text-sm text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {pendingAgentId === agent.id ? 'Suspending...' : 'Suspend'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(agent.id)}
                          disabled={pendingAgentId === agent.id}
                          className="text-sm text-green-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {pendingAgentId === agent.id ? 'Activating...' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Agent Sheet */}
      <AddAgentSheet open={addSheetOpen} onOpenChange={setAddSheetOpen} />
    </div>
  );
}
