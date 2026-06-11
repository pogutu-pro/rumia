'use client';

import { useRouter } from 'next/navigation';

const icons = {
  listings: 'M3 21h18M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z',
  leads: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  commissions: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  agents: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
};

interface OverviewClientProps {
  stats: {
    activeListings: number;
    monthlyLeads: number;
    pendingCommissionsKes: number;
    activeAgents: number;
  };
  recentLeads: Array<{
    id: string;
    clicked_at: string;
    listings: { id: string; title: string } | null;
    agents: { id: string; name: string } | null;
  }>;
  topAgents: Array<{
    agent: { id: string; name: string };
    leadCount: number;
    commissionOwed: number;
  }>;
}

export function OverviewClient({ stats, recentLeads, topAgents }: OverviewClientProps) {
  const router = useRouter();

  const maxLeadCount = topAgents.length > 0
    ? Math.max(...topAgents.map((a) => a.leadCount))
    : 1;

  const activeTopAgents = topAgents.filter((a) => a.leadCount > 0);

  const statCards = [
    { label: 'Active Listings', value: stats.activeListings, icon: icons.listings, color: 'bg-blue-50 text-blue-600' },
    { label: 'Leads This Month', value: stats.monthlyLeads, icon: icons.leads, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Commissions Pending', value: `KES ${stats.pendingCommissionsKes.toLocaleString()}`, icon: icons.commissions, color: 'bg-amber-50 text-amber-600' },
    { label: 'Active Agents', value: stats.activeAgents, icon: icons.agents, color: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Your Rumia marketplace at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Leads</h2>
          </div>
          {recentLeads.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-400">No leads recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push('/listing/' + lead.listings?.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {lead.listings?.title ?? '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {lead.agents?.name ?? '—'} &middot; {new Date(lead.clicked_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 ml-3">
                    {new Date(lead.clicked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Agents */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Top Agents This Month</h2>
          </div>
          {activeTopAgents.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-400">No agent activity this month.</p>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">
              {activeTopAgents.map(({ agent, leadCount, commissionOwed }) => (
                <div key={agent.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{agent.name}</span>
                    <span className="text-xs text-gray-500">{leadCount} lead{leadCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="text-xs text-gray-400 mb-1.5">KES {commissionOwed.toLocaleString()} owed</div>
                  <div className="bg-gray-100 rounded-full h-1.5 w-full overflow-hidden">
                    <div
                      className="bg-emerald-500 rounded-full h-1.5 transition-all"
                      style={{ width: `${(leadCount / maxLeadCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
