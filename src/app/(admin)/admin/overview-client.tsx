'use client';

import { useRouter } from 'next/navigation';

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

  // Only show agents that have at least 1 lead this month
  const activeTopAgents = topAgents.filter((a) => a.leadCount > 0);

  return (
    <div>
      {/* Page title */}
      <h1 className="text-2xl font-semibold mb-6">Overview</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Active Listings</p>
          <p className="text-2xl font-semibold mt-1">{stats.activeListings}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Leads This Month</p>
          <p className="text-2xl font-semibold mt-1">{stats.monthlyLeads}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Commissions Pending</p>
          <p className="text-2xl font-semibold mt-1">
            KES {stats.pendingCommissionsKes.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Active Agents</p>
          <p className="text-2xl font-semibold mt-1">{stats.activeAgents}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        {/* Recent Leads */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Leads</h2>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-gray-500">No leads recorded yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left pb-3">
                    Listing Name
                  </th>
                  <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left pb-3">
                    Agent Name
                  </th>
                  <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left pb-3">
                    Date
                  </th>
                  <th className="text-xs font-medium text-gray-500 uppercase tracking-wider text-left pb-3">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push('/listing/' + lead.listings?.id)}
                  >
                    <td className="text-sm py-3 pr-4">
                      {lead.listings?.title ?? '—'}
                    </td>
                    <td className="text-sm py-3 pr-4">
                      {lead.agents?.name ?? '—'}
                    </td>
                    <td className="text-sm py-3 pr-4">
                      {new Date(lead.clicked_at).toLocaleDateString()}
                    </td>
                    <td className="text-sm py-3">
                      {new Date(lead.clicked_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Agents This Month */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Top Agents This Month</h2>
          {activeTopAgents.length === 0 ? (
            <p className="text-sm text-gray-500">No agent activity this month.</p>
          ) : (
            <ul className="space-y-4">
              {activeTopAgents.map(({ agent, leadCount, commissionOwed }) => (
                <li key={agent.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {agent.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {leadCount} lead{leadCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mb-1.5">
                    KES {commissionOwed.toLocaleString()} owed
                  </div>
                  {/* Relative bar */}
                  <div className="bg-gray-100 rounded h-1.5 w-full">
                    <div
                      className="bg-blue-500 rounded h-1.5"
                      style={{
                        width: `${(leadCount / maxLeadCount) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
