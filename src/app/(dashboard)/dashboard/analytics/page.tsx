import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ArrowLeft, Eye } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function AgentAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agent) redirect('/dashboard');

  const { data: listingViewAnalyticsRaw } = await (supabase as any).rpc(
    'get_agent_listing_view_analytics',
    { p_agent_id: agent.id }
  );

  const listingViewAnalytics = (listingViewAnalyticsRaw ?? []).map(
    (row: any) => ({
      listing_id: row.listing_id,
      listing_title: row.listing_title,
      listing_slug: row.listing_slug,
      county: row.county || 'nyeri',
      area: row.area || 'dekut',
      today_count: Number(row.today_count || 0),
      week_count: Number(row.week_count || 0),
      month_count: Number(row.month_count || 0),
      all_time_count: Number(row.all_time_count || 0),
    })
  );

  const viewSummary = listingViewAnalytics.reduce(
    (acc: any, row: any) => ({
      today: acc.today + row.today_count,
      week: acc.week + row.week_count,
      month: acc.month + row.month_count,
      allTime: acc.allTime + row.all_time_count,
    }),
    { today: 0, week: 0, month: 0, allTime: 0 }
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Analytics
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Student views across all your listings.
        </p>
      </div>

      {/* View Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          ['Today', viewSummary.today],
          ['This Week', viewSummary.week],
          ['This Month', viewSummary.month],
          ['All Time', viewSummary.allTime],
        ].map(([label, value]) => (
          <div
            key={label}
            className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex items-center gap-3"
          >
            <div className="p-2.5 sm:p-3 rounded-xl bg-indigo-50 text-indigo-600">
              <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                {label}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
                {Number(value).toLocaleString()}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Per-Listing View Analytics */}
      {listingViewAnalytics.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Views by Listing</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 sm:px-5 py-3">Listing</th>
                    <th className="px-4 sm:px-5 py-3 text-right">Today</th>
                    <th className="px-4 sm:px-5 py-3 text-right">Week</th>
                    <th className="px-4 sm:px-5 py-3 text-right">Month</th>
                    <th className="px-4 sm:px-5 py-3 text-right">All Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listingViewAnalytics.map((row: any) => {
                    const href = row.listing_slug
                      ? `/hostels/${row.county}/${row.area}/${row.listing_slug}`
                      : `/listing/${row.listing_id}`;

                    return (
                      <tr key={row.listing_id} className="hover:bg-slate-50/60">
                        <td className="px-4 sm:px-5 py-3.5 font-bold text-slate-900">
                          <Link href={href} className="hover:text-emerald-600 transition-colors">
                            {row.listing_title}
                          </Link>
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right font-semibold text-slate-600 tabular-nums">
                          {row.today_count.toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right font-semibold text-slate-600 tabular-nums">
                          {row.week_count.toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                          {row.month_count.toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right font-semibold text-slate-600 tabular-nums">
                          {row.all_time_count.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
          <p className="text-sm text-slate-400 font-semibold">
            View analytics will appear after students visit your listings.
          </p>
        </div>
      )}
    </div>
  );
}
