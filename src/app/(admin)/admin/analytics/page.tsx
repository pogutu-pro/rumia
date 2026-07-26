import Link from 'next/link';
import { Eye, Users, Building2, TrendingUp, CalendarDays } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const revalidate = 60;

function count(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function AdminAnalyticsPage() {
  const [
    { data: summaryRows },
    { data: studentCountRaw },
    { data: topListingsRaw },
    { data: topAgentsRaw },
  ] = await Promise.all([
    supabaseAdmin.rpc('get_platform_view_summary'),
    supabaseAdmin.rpc('get_registered_student_count'),
    supabaseAdmin.rpc('get_admin_listing_view_analytics', { p_limit: 20 }),
    supabaseAdmin.rpc('get_admin_agent_view_analytics'),
  ]);

  const summary = Array.isArray(summaryRows) ? summaryRows[0] : summaryRows;
  const topListings = topListingsRaw ?? [];
  const topAgents = topAgentsRaw ?? [];
  const totalStudents = count(studentCountRaw);

  const viewStats = [
    { label: 'Today', value: count(summary?.today_count), icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'This Week', value: count(summary?.week_count), icon: CalendarDays, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'This Month', value: count(summary?.month_count), icon: Eye, color: 'text-amber-600 bg-amber-50' },
    { label: 'All Time', value: count(summary?.all_time_count), icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Registered Students', value: totalStudents, icon: Users, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Listing view performance across the Rumia marketplace.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {viewStats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Top Listings */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Top Listings This Month</h2>
            <p className="text-xs text-slate-500">Twenty most viewed listings.</p>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-50 text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Listing</th>
                <th className="px-5 py-3 text-left">Agent</th>
                <th className="px-5 py-3 text-left">Location</th>
                <th className="px-5 py-3 text-right">Today</th>
                <th className="px-5 py-3 text-right">Week</th>
                <th className="px-5 py-3 text-right">Month</th>
                <th className="px-5 py-3 text-right">All Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topListings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">No listing views recorded yet.</td>
                </tr>
              ) : (
                topListings.map((listing: any) => (
                  <tr key={listing.listing_id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <Link href={`/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.listing_slug}`} className="hover:text-emerald-600">
                        {listing.listing_title}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{listing.agent_name}</td>
                    <td className="px-5 py-4 text-slate-500">{listing.location}</td>
                    <td className="px-5 py-4 text-right font-medium">{count(listing.today_count).toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-medium">{count(listing.week_count).toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-semibold">{count(listing.month_count).toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-medium">{count(listing.all_time_count).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-50">
          {topListings.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">No listing views recorded yet.</div>
          ) : (
            topListings.map((listing: any) => (
              <div key={listing.listing_id} className="px-5 py-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.listing_slug}`} className="text-sm font-medium text-slate-900 hover:text-emerald-600 leading-snug">
                    {listing.listing_title}
                  </Link>
                  <span className="text-xs font-semibold text-emerald-600 whitespace-nowrap">{count(listing.month_count).toLocaleString()} mo</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{listing.agent_name}</span>
                  <span>·</span>
                  <span>{listing.location}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{count(listing.today_count).toLocaleString()} today</span>
                  <span>{count(listing.week_count).toLocaleString()} week</span>
                  <span>{count(listing.all_time_count).toLocaleString()} all time</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Top Agents */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Top Agents This Month</h2>
            <p className="text-xs text-slate-500">Agents ranked by listing views.</p>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-50 text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Agent</th>
                <th className="px-5 py-3 text-right">Active Listings</th>
                <th className="px-5 py-3 text-right">Views This Month</th>
                <th className="px-5 py-3 text-right">Views All Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topAgents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">No agent view data recorded yet.</td>
                </tr>
              ) : (
                topAgents.map((agent: any) => (
                  <tr key={agent.agent_id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <Link href={`/admin/agents/${agent.agent_id}`} className="hover:text-emerald-600">{agent.agent_name}</Link>
                    </td>
                    <td className="px-5 py-4 text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {count(agent.active_listings_count).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">{count(agent.month_count).toLocaleString()}</td>
                    <td className="px-5 py-4 text-right font-medium">{count(agent.all_time_count).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-50">
          {topAgents.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">No agent view data recorded yet.</div>
          ) : (
            topAgents.map((agent: any) => (
              <div key={agent.agent_id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <Link href={`/admin/agents/${agent.agent_id}`} className="text-sm font-medium text-slate-900 hover:text-emerald-600">
                    {agent.agent_name}
                  </Link>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <Building2 className="h-3 w-3 inline mr-1" />
                    {count(agent.active_listings_count).toLocaleString()} listings
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{count(agent.month_count).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{count(agent.all_time_count).toLocaleString()} all time</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
