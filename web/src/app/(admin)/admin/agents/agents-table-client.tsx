'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  updateAgentStatusAction,
  updateUserRoleAction,
  promoteToAdminAction,
  toggleAgentFeaturedAction,
  toggleAgentFounderAction,
} from '@/app/actions/admin';
import type { AdminAgent } from '@/types';
import { AddAgentSheet } from './add-agent-sheet';
import { EditAgentSheet } from './[id]/edit-agent-sheet';
import { assignManagerRoleAction } from '@/app/actions/staff';

interface AgentsTableClientProps {
  agents: AdminAgent[];
  campuses?: { id: string; name: string }[];
}

export function AgentsTableClient({ agents, campuses }: AgentsTableClientProps) {
  const router = useRouter();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<{ id: string; name: string; phone: string; whatsapp: string } | null>(null);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [promoteToManagerId, setPromoteToManagerId] = useState<string | null>(null);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('');
  const [pendingFeaturedId, setPendingFeaturedId] = useState<string | null>(null);
  const [pendingFounderId, setPendingFounderId] = useState<string | null>(null);

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

  async function handleDemoteToAgent(userId: string, agentId: string) {
    const confirmed = window.confirm('Demote this user to agent? They will lose access to their current dashboards.');
    if (!confirmed) return;
    setPendingRoleId(agentId);
    const result = await updateUserRoleAction(userId, 'agent');
    setPendingRoleId(null);
    if (result.success) { toast.success('User demoted to agent'); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function handlePromoteToAdmin(userId: string, agentId: string) {
    const confirmed = window.confirm('Promote this user to Admin? They will gain full admin access.');
    if (!confirmed) return;
    setPendingRoleId(agentId);
    const result = await promoteToAdminAction(userId);
    setPendingRoleId(null);
    if (result.success) { toast.success('User promoted to admin'); router.refresh(); }
    else { toast.error(result.error); }
  }

  async function submitPromoteToManager(userId: string, agentId: string) {
    if (!selectedCampusId) {
      toast.error('Please select a campus first');
      return;
    }
    setPendingRoleId(agentId);
    const result = await assignManagerRoleAction(userId, {
      role: 'manager',
      managed_campus_id: selectedCampusId,
    });
    setPendingRoleId(null);
    if (result.success) {
      toast.success('Agent promoted to manager');
      setPromoteToManagerId(null);
      setSelectedCampusId('');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleToggleOfficial(agentId: string, current: boolean) {
    setPendingFeaturedId(agentId);
    const result = await toggleAgentFeaturedAction(agentId, !current);
    setPendingFeaturedId(null);
    if (result.success) {
      toast.success(current ? 'Official badge removed' : 'Official badge granted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleToggleFounder(agentId: string, current: boolean) {
    setPendingFounderId(agentId);
    const result = await toggleAgentFounderAction(agentId, !current);
    setPendingFounderId(null);
    if (result.success) {
      toast.success(current ? 'Founder badge removed' : 'Founder badge granted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Agents</h1>
          <p className="text-sm text-slate-500 mt-1">{agents.length} agent{agents.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button onClick={() => setAddSheetOpen(true)} className="rounded-2xl">Add Agent</Button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50">
              {['Name', 'Phone / WhatsApp', 'Active Listings', 'Total Leads', 'Commission Pending (KES)', 'Role', 'Status', 'Official', 'Founder', 'Actions'].map((h) => (
                <th key={h} className="text-xs font-medium text-slate-500 uppercase tracking-wider text-left px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {agents.length === 0 ? (
              <tr><td colSpan={10} className="text-sm text-slate-400 text-center px-5 py-8">No agents registered.</td></tr>
            ) : agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
                <td className="text-sm px-5 py-4">
                  <Link href={`/admin/agents/${agent.id}`} className="font-medium text-slate-900 hover:text-emerald-600">{agent.name}</Link>
                </td>
                <td className="text-sm text-slate-600 px-5 py-4">
                  <div>{agent.phone}</div>
                  {agent.whatsapp && agent.whatsapp !== agent.phone && <div className="text-slate-400 text-xs">{agent.whatsapp}</div>}
                </td>
                <td className="text-sm text-slate-600 px-5 py-4">{agent.active_listings_count ?? 0}</td>
                <td className="text-sm text-slate-600 px-5 py-4">{agent.total_leads_count ?? 0}</td>
                <td className="text-sm text-slate-600 px-5 py-4">{(agent.pending_commissions_sum ?? 0).toLocaleString()}</td>

                {/* Role */}
                <td className="px-5 py-4">
                  {agent.role === 'admin' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700">Admin</span>
                      <button
                        onClick={() => handleDemoteToAgent(agent.user_id, agent.id)}
                        disabled={pendingRoleId === agent.id}
                        className="text-xs text-amber-600 hover:underline disabled:opacity-50 font-medium"
                      >
                        {pendingRoleId === agent.id ? '...' : 'Demote to Agent'}
                      </button>
                    </div>
                  ) : agent.role === 'manager' ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Manager</span>
                        <button
                          onClick={() => handleDemoteToAgent(agent.user_id, agent.id)}
                          disabled={pendingRoleId === agent.id}
                          className="text-xs text-amber-600 hover:underline disabled:opacity-50 font-medium"
                        >
                          {pendingRoleId === agent.id ? '...' : 'Demote'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePromoteToAdmin(agent.user_id, agent.id)}
                          disabled={pendingRoleId === agent.id}
                          className="text-xs text-purple-600 hover:underline disabled:opacity-50 font-medium"
                        >
                          {pendingRoleId === agent.id ? '...' : 'Make Admin'}
                        </button>
                        {agent.campus_id && campuses && (
                          <span className="text-[10px] text-slate-500">
                            {campuses.find(c => c.id === agent.campus_id)?.name || 'Campus'}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">Agent</span>
                        <button
                          onClick={() => setPromoteToManagerId(agent.id)}
                          disabled={pendingRoleId === agent.id}
                          className="text-xs text-indigo-600 hover:underline disabled:opacity-50 font-medium whitespace-nowrap"
                        >
                          Make Manager
                        </button>
                        <button
                          onClick={() => handlePromoteToAdmin(agent.user_id, agent.id)}
                          disabled={pendingRoleId === agent.id}
                          className="text-xs text-purple-600 hover:underline disabled:opacity-50 font-medium whitespace-nowrap"
                        >
                          {pendingRoleId === agent.id ? '...' : 'Make Admin'}
                        </button>
                      </div>
                      {promoteToManagerId === agent.id && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2 min-w-[200px]">
                          <p className="text-xs font-medium text-slate-700">Select Campus to Manage</p>
                          <select
                            className="w-full text-sm border-slate-200 rounded-md py-1.5 px-2 bg-white"
                            value={selectedCampusId}
                            onChange={(e) => setSelectedCampusId(e.target.value)}
                          >
                            <option value="">-- Choose --</option>
                            {(campuses || []).map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2 justify-end pt-1">
                            <button
                              onClick={() => { setPromoteToManagerId(null); setSelectedCampusId(''); }}
                              className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => submitPromoteToManager(agent.user_id, agent.id)}
                              disabled={!selectedCampusId || pendingRoleId === agent.id}
                              className="text-xs bg-indigo-600 text-white font-medium px-3 py-1.5 rounded disabled:opacity-50"
                            >
                              {pendingRoleId === agent.id ? 'Saving...' : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </td>

                {/* Status */}
                <td className="px-5 py-4">
                  {agent.status === 'active' ? (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">Suspended</span>
                  )}
                </td>

                {/* Official badge (is_featured) */}
                <td className="px-5 py-4">
                  <button
                    onClick={() => handleToggleOfficial(agent.id, !!agent.is_featured)}
                    disabled={pendingFeaturedId === agent.id}
                    title={agent.is_featured ? 'Remove Official badge' : 'Grant Official badge'}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
                      agent.is_featured
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                        : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
                    }`}
                  >
                    {pendingFeaturedId === agent.id ? '...' : agent.is_featured ? '★ Official' : '☆ Official'}
                  </button>
                </td>

                {/* Founder badge (is_founder) */}
                <td className="px-5 py-4">
                  <button
                    onClick={() => handleToggleFounder(agent.id, !!agent.is_founder)}
                    disabled={pendingFounderId === agent.id}
                    title={agent.is_founder ? 'Remove Founder badge' : 'Grant Founder badge'}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
                      agent.is_founder
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                        : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                    }`}
                  >
                    {pendingFounderId === agent.id ? '...' : agent.is_founder ? '🏅 Founder' : '○ Founder'}
                  </button>
                </td>

                {/* Actions */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Link href={`/admin/agents/${agent.id}`} className="text-emerald-600 hover:underline font-medium">View</Link>
                    <button
                      onClick={() => setEditAgent({ id: agent.id, name: agent.name, phone: agent.phone, whatsapp: agent.whatsapp })}
                      className="text-slate-500 hover:text-slate-700 hover:underline font-medium"
                    >
                      Edit
                    </button>
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
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 text-center text-sm text-slate-400 shadow-sm">No agents registered.</div>
        ) : agents.map((agent) => (
          <div key={agent.id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <Link href={`/admin/agents/${agent.id}`} className="text-sm font-semibold text-slate-900 hover:text-emerald-600">{agent.name}</Link>
                <p className="text-xs text-slate-400 mt-0.5">{agent.phone}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {agent.role === 'admin' ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Admin</span>
                ) : agent.role === 'manager' ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Manager</span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Agent</span>
                )}
                {agent.status === 'active' ? (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
                ) : (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">Suspended</span>
                )}
                {agent.is_featured && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">★ Official</span>
                )}
                {agent.is_founder && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">🏅 Founder</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-xs text-slate-400">Listings</p>
                <p className="text-sm font-semibold text-slate-900">{agent.active_listings_count ?? 0}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-xs text-slate-400">Leads</p>
                <p className="text-sm font-semibold text-slate-900">{agent.total_leads_count ?? 0}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-xs text-slate-400">Commission</p>
                <p className="text-sm font-semibold text-slate-900">{(agent.pending_commissions_sum ?? 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <Link href={`/admin/agents/${agent.id}`} className="text-xs font-medium text-emerald-600 hover:underline">View Profile</Link>
              <button
                onClick={() => setEditAgent({ id: agent.id, name: agent.name, phone: agent.phone, whatsapp: agent.whatsapp })}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
              >
                Edit
              </button>

              {/* Official toggle */}
              <button
                onClick={() => handleToggleOfficial(agent.id, !!agent.is_featured)}
                disabled={pendingFeaturedId === agent.id}
                className={`text-xs font-medium disabled:opacity-50 ${
                  agent.is_featured ? 'text-amber-600 hover:underline' : 'text-slate-400 hover:text-amber-600 hover:underline'
                }`}
              >
                {pendingFeaturedId === agent.id ? '...' : agent.is_featured ? '★ Remove Official' : '☆ Grant Official'}
              </button>

              {/* Founder toggle */}
              <button
                onClick={() => handleToggleFounder(agent.id, !!agent.is_founder)}
                disabled={pendingFounderId === agent.id}
                className={`text-xs font-medium disabled:opacity-50 ${
                  agent.is_founder ? 'text-indigo-600 hover:underline' : 'text-slate-400 hover:text-indigo-600 hover:underline'
                }`}
              >
                {pendingFounderId === agent.id ? '...' : agent.is_founder ? '🏅 Remove Founder' : '○ Grant Founder'}
              </button>

              {/* Role */}
              {agent.role === 'manager' && (
                <button onClick={() => handlePromoteToAdmin(agent.user_id, agent.id)} disabled={pendingRoleId === agent.id} className="text-xs font-medium text-purple-600 hover:underline disabled:opacity-50">
                  {pendingRoleId === agent.id ? '...' : 'Make Admin'}
                </button>
              )}
              {agent.role === 'admin' || agent.role === 'manager' ? (
                <button onClick={() => handleDemoteToAgent(agent.user_id, agent.id)} disabled={pendingRoleId === agent.id} className="text-xs font-medium text-amber-600 hover:underline disabled:opacity-50">
                  {pendingRoleId === agent.id ? '...' : 'Demote to Agent'}
                </button>
              ) : (
                <>
                  <button onClick={() => setPromoteToManagerId(agent.id)} disabled={pendingRoleId === agent.id} className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50">
                    Promote to Manager
                  </button>
                  <button onClick={() => handlePromoteToAdmin(agent.user_id, agent.id)} disabled={pendingRoleId === agent.id} className="text-xs font-medium text-purple-600 hover:underline disabled:opacity-50">
                    {pendingRoleId === agent.id ? '...' : 'Make Admin'}
                  </button>
                </>
              )}

              {promoteToManagerId === agent.id && agent.role !== 'manager' && agent.role !== 'admin' && (
                <div className="w-full mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
                  <p className="text-xs font-medium text-slate-700">Select Campus to Manage</p>
                  <select
                    className="w-full text-sm border-slate-200 rounded-md py-1.5 px-2 bg-white"
                    value={selectedCampusId}
                    onChange={(e) => setSelectedCampusId(e.target.value)}
                  >
                    <option value="">-- Choose --</option>
                    {(campuses || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 justify-end pt-1">
                    <button onClick={() => { setPromoteToManagerId(null); setSelectedCampusId(''); }} className="text-xs text-slate-500 font-medium px-2 py-1">Cancel</button>
                    <button onClick={() => submitPromoteToManager(agent.user_id, agent.id)} disabled={!selectedCampusId || pendingRoleId === agent.id} className="text-xs bg-indigo-600 text-white font-medium px-3 py-1.5 rounded disabled:opacity-50">Confirm</button>
                  </div>
                </div>
              )}

              {/* Suspend / Activate */}
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
      {editAgent && (
        <EditAgentSheet
          open={!!editAgent}
          onOpenChange={(open: boolean) => { if (!open) setEditAgent(null); }}
          agent={editAgent}
        />
      )}
    </div>
  );
}
