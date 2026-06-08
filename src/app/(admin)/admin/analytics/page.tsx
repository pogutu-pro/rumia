import Link from 'next/link';
import { Eye, Users, Building2 } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const revalidate = 60;

function count(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stat(label: string, value: number) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Listing view performance across the Rumia marketplace.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stat('Views Today', count(summary?.today_count))}
        {stat('Views This Week', count(summary?.week_count))}
        {stat('Views This Month', count(summary?.month_count))}
        {stat('Views All Time', count(summary?.all_time_count))}
        {stat('Registered Students', totalStudents)}
      </div>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div className="rounded-md bg-blue-50 p-2 text-blue-700">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Top Listings This Month</h2>
            <p className="text-sm text-gray-500">Twenty most viewed active and inactive listings.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-6 py-3 text-left">Listing</th>
                <th className="px-6 py-3 text-left">Agent</th>
                <th className="px-6 py-3 text-left">Location</th>
                <th className="px-6 py-3 text-right">Today</th>
                <th className="px-6 py-3 text-right">Week</th>
                <th className="px-6 py-3 text-right">Month</th>
                <th className="px-6 py-3 text-right">All Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topListings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">
                    No listing views recorded yet.
                  </td>
                </tr>
              ) : (
                topListings.map((listing: any) => {
                  const href = listing.listing_slug
                    ? `/hostels/${listing.county || 'nyeri'}/${listing.area || 'dekut'}/${listing.listing_slug}`
                    : `/listing/${listing.listing_id}`;

                  return (
                    <tr key={listing.listing_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <Link href={href} className="hover:text-emerald-600">
                          {listing.listing_title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{listing.agent_name}</td>
                      <td className="px-6 py-4 text-gray-500">{listing.location}</td>
                      <td className="px-6 py-4 text-right font-medium">{count(listing.today_count).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-medium">{count(listing.week_count).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">{count(listing.month_count).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-medium">{count(listing.all_time_count).toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Top Agents This Month</h2>
            <p className="text-sm text-gray-500">Agents ranked by listing views.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-6 py-3 text-left">Agent</th>
                <th className="px-6 py-3 text-right">Active Listings</th>
                <th className="px-6 py-3 text-right">Views This Month</th>
                <th className="px-6 py-3 text-right">Views All Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topAgents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                    No agent view data recorded yet.
                  </td>
                </tr>
              ) : (
                topAgents.map((agent: any) => (
                  <tr key={agent.agent_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <Link href={`/admin/agents/${agent.agent_id}`} className="hover:text-emerald-600">
                        {agent.agent_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        {count(agent.active_listings_count).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">{count(agent.month_count).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-medium">{count(agent.all_time_count).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
