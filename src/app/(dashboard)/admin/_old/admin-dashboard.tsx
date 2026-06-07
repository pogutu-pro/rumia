'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Users, CreditCard, MousePointerClick, Check, X, Loader2, MessageSquare, Phone } from 'lucide-react';

interface Agent {
  id: string | number;
  name: string;
  phone: string;
  whatsapp: string;
  commission_balance: number;
  user_id: string;
}

interface Commission {
  id: string | number;
  amount: number;
  status: 'pending' | 'paid';
  agent_id: string | number;
  listings?: { title: string } | null;
  agents?: { name: string } | null;
}

interface Lead {
  id: string | number;
  clicked_at: string;
  ip_hash: string;
  listings?: { title: string } | null;
  agents?: { name: string } | null;
}

interface AdminDashboardProps {
  initialAgents: Agent[];
  initialCommissions: Commission[];
  initialLeads: Lead[];
}

export function AdminDashboard({
  initialAgents,
  initialCommissions,
  initialLeads,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'agents' | 'commissions' | 'leads'>('agents');
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [commissions, setCommissions] = useState<Commission[]>(initialCommissions);
  const [leads] = useState<Lead[]>(initialLeads);
  
  const [togglingId, setTogglingId] = useState<string | number | null>(null);
  const supabase = createClient();

  const handleToggleCommissionStatus = async (
    commId: string | number,
    currentStatus: 'pending' | 'paid',
    agentId: string | number,
    amount: number
  ) => {
    if (togglingId) return;
    setTogglingId(commId);

    const newStatus: 'pending' | 'paid' = currentStatus === 'pending' ? 'paid' : 'pending';

    try {
      // 1. Update commission status in Supabase
      const { error: commError } = await supabase
        .from('commissions')
        .update({ status: newStatus })
        .eq('id', commId);

      if (commError) throw commError;

      // 2. Fetch current agent balance
      const agentToUpdate = agents.find((a) => a.id === agentId);
      if (agentToUpdate) {
        // Recalculate balance: if marked paid, subtract from balance (or vice-versa depending on balance definition)
        // Here, commission owed = pending balance. So:
        // - if status goes to paid: pending balance drops (we subtract commission amount)
        // - if status goes to pending: pending balance goes up (we add commission amount)
        const balanceChange = newStatus === 'paid' ? -amount : amount;
        const newBalance = Math.max(0, agentToUpdate.commission_balance + balanceChange);

        const { error: agentError } = await supabase
          .from('agents')
          .update({ commission_balance: newBalance })
          .eq('id', agentId);

        if (agentError) {
          console.error('Error updating agent balance in DB:', agentError);
        }

        // Update local agent state
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, commission_balance: newBalance } : a))
        );
      }

      // Update local commission state
      setCommissions((prev) =>
        prev.map((c) => (c.id === commId ? { ...c, status: newStatus } : c))
      );

      toast.success(`Commission status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update commission status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs Menu */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6 -mb-px">
          {[
            { id: 'agents', label: 'Agents', icon: <Users className="h-4.5 w-4.5" /> },
            { id: 'commissions', label: 'Commissions', icon: <CreditCard className="h-4.5 w-4.5" /> },
            { id: 'leads', label: 'Leads History', icon: <MousePointerClick className="h-4.5 w-4.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm font-medium text-slate-500">
              <thead className="bg-slate-55 bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Agent Name</th>
                  <th className="px-6 py-4">Phone Number</th>
                  <th className="px-6 py-4">WhatsApp</th>
                  <th className="px-6 py-4 text-right">Commission Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-900 bg-white">
                {agents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      No agents registered.
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4 font-bold">{agent.name}</td>
                      <td className="px-6 py-4 text-slate-500 font-semibold">{agent.phone || '-'}</td>
                      <td className="px-6 py-4 text-slate-500 font-semibold">{agent.whatsapp || '-'}</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600">
                        KES {agent.commission_balance.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commissions Tab */}
      {activeTab === 'commissions' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm font-medium text-slate-500">
              <thead className="bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Agent</th>
                  <th className="px-6 py-4">Listing</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-900 bg-white">
                {commissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                      No commission records.
                    </td>
                  </tr>
                ) : (
                  commissions.map((comm) => (
                    <tr key={comm.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4 font-bold">{comm.agents?.name || 'Unknown Agent'}</td>
                      <td className="px-6 py-4 text-slate-500 font-semibold">{comm.listings?.title || 'Unknown Listing'}</td>
                      <td className="px-6 py-4 font-black">KES {comm.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {comm.status === 'paid' ? (
                          <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() =>
                            handleToggleCommissionStatus(
                              comm.id,
                              comm.status,
                              comm.agent_id,
                              comm.amount
                            )
                          }
                          disabled={togglingId === comm.id}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            comm.status === 'paid'
                              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100'
                          } disabled:opacity-50`}
                        >
                          {togglingId === comm.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : comm.status === 'paid' ? (
                            'Mark Unpaid'
                          ) : (
                            'Mark Paid'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leads Tab */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm font-medium text-slate-500">
              <thead className="bg-slate-55 bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Click Date</th>
                  <th className="px-6 py-4">Listing Title</th>
                  <th className="px-6 py-4">Attributed Agent</th>
                  <th className="px-6 py-4 text-right">IP Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-900 bg-white">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                      No lead clicks registered yet.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/40">
                      <td className="px-6 py-4 text-slate-500 font-semibold">
                        {new Date(lead.clicked_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-bold">{lead.listings?.title || 'Unknown Listing'}</td>
                      <td className="px-6 py-4 text-slate-500 font-semibold">{lead.agents?.name || 'Unknown Agent'}</td>
                      <td className="px-6 py-4 text-right text-xs font-mono text-slate-400">
                        {lead.ip_hash.substring(0, 10)}...
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
