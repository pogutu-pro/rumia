'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Search, Loader2, Phone, Building2, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { updateAgentStatusByManagerAction } from '@/app/actions/manager';

interface AgentRecord {
  id: string;
  user_id: string;
  campus_id: string;
  name: string;
  phone: string;
  whatsapp: string;
  status: 'active' | 'suspended';
  verified: boolean;
  is_featured: boolean;
  is_founder: boolean;
  slug: string;
  created_at: string;
  campuses?: { name: string; slug: string } | null;
}

interface AgentsTableClientProps {
  initialAgents: AgentRecord[];
}

export function AgentsTableClient({ initialAgents }: AgentsTableClientProps) {
  const [agents, setAgents] = useState<AgentRecord[]>(initialAgents);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeModalAgent, setActiveModalAgent] = useState<AgentRecord | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');

  const filteredAgents = agents.filter(
    (agent) =>
      searchQuery === '' ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.phone.includes(searchQuery)
  );

  const handleToggleStanding = async () => {
    if (!activeModalAgent) return;

    const nextStatus: 'active' | 'suspended' =
      activeModalAgent.status === 'active' ? 'suspended' : 'active';

    setLoadingId(activeModalAgent.id);
    setErrorMsg(null);

    try {
      const res = await updateAgentStatusByManagerAction(
        activeModalAgent.id,
        nextStatus,
        nextStatus === 'suspended' ? suspensionReason : undefined,
      );

      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setAgents((prev) =>
          prev.map((item) =>
            item.id === activeModalAgent.id ? { ...item, status: nextStatus } : item
          )
        );
        setActiveModalAgent(null);
        setSuspensionReason('');
      }
    } catch {
      setErrorMsg('Failed to update agent standing.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by name or phone number..."
            className="w-full h-9 pl-9 pr-3 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Agents List */}
      {filteredAgents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-sm">
          No agents found for your campus.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 hover:border-slate-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{agent.name}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      agent.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {agent.status === 'active' ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                    {agent.status}
                  </span>
                  {agent.verified && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                      Verified
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Phone: {agent.phone}</span>
                  <span>
                    Campus:{' '}
                    {Array.isArray(agent.campuses)
                      ? agent.campuses[0]?.name || 'Campus'
                      : agent.campuses?.name || 'Campus'}
                  </span>
                  <span>Joined: {new Date(agent.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Button: Account Standing Control (active ↔ suspended) */}
              <div>
                <button
                  onClick={() => {
                    setActiveModalAgent(agent);
                    setSuspensionReason('');
                  }}
                  disabled={loadingId === agent.id}
                  className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    agent.status === 'active'
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {loadingId === agent.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : agent.status === 'active' ? (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                  {agent.status === 'active' ? 'Suspend Account' : 'Reinstate Account'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account Standing Confirmation Modal */}
      {activeModalAgent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {activeModalAgent.status === 'active'
                ? `Suspend Agent Account: ${activeModalAgent.name}?`
                : `Reinstate Agent Account: ${activeModalAgent.name}?`}
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              {activeModalAgent.status === 'active'
                ? `Suspending ${activeModalAgent.name}'s account standing will temporarily pause their ability to post new hostels until the issue is resolved and the account is reinstated.`
                : `Reinstating ${activeModalAgent.name}'s account standing will restore their active status.`}
            </p>

            {activeModalAgent.status === 'active' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Suspension Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="e.g. Fraudulent listing reported by students..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setActiveModalAgent(null);
                  setSuspensionReason('');
                  setErrorMsg(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleToggleStanding}
                disabled={loadingId === activeModalAgent.id || (activeModalAgent.status === 'active' && !suspensionReason.trim())}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  activeModalAgent.status === 'active'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {loadingId === activeModalAgent.id && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Confirm {activeModalAgent.status === 'active' ? 'Suspension' : 'Reinstatement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
