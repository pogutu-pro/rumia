import { createClient } from '@/lib/auth/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { Eye } from 'lucide-react';
import { DashboardPageHeader } from '@/app/(dashboard)/dashboard-ui';
import Link from 'next/link';

export const revalidate = 0;

export default async function AgentAnalyticsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent) redirect('/dashboard');

  const listingViewAnalytics = (
    await agentDashboardApi.viewAnalytics(agent.id).catch(() => [])
  ).map((row) => ({
    listing_id: row.listing_id,
    listing_title: row.listing_title,
    listing_slug: row.listing_slug,
    county: row.county,
    area: row.area,
    today_count: Number(row.today_count || 0),
    week_count: Number(row.week_count || 0),
    month_count: Number(row.month_count || 0),
    all_time_count: Number(row.all_time_count || 0),
  }));

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
      <DashboardPageHeader title="Analytics" description="How many students are viewing each of your listings." />

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
            className="bg-raised p-4 sm:p-5 rounded-2xl border border-line flex items-center gap-3"
          >
            <div className="p-2.5 sm:p-3 rounded-xl bg-indigo-50 text-indigo-600">
              <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-ink-muted uppercase tracking-wider">
                {label}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-ink mt-0.5 tabular-nums">
                {Number(value).toLocaleString()}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Per-Listing View Analytics */}
      {listingViewAnalytics.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-ink">Views by Listing</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-raised">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line text-left text-sm">
                <thead className="bg-subtle text-[10px] sm:text-xs font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-4 sm:px-5 py-3">Listing</th>
                    <th className="px-4 sm:px-5 py-3 text-right">Today</th>
                    <th className="px-4 sm:px-5 py-3 text-right">Week</th>
                    <th className="px-4 sm:px-5 py-3 text-right">Month</th>
                    <th className="px-4 sm:px-5 py-3 text-right">All Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {listingViewAnalytics.map((row: any) => {
                    const href = row.listing_slug
                      ? `/hostels/${row.county}/${row.area}/${row.listing_slug}`
                      : `/listing/${row.listing_id}`;

                    return (
                      <tr key={row.listing_id} className="hover:bg-subtle">
                        <td className="px-4 sm:px-5 py-3.5 font-bold text-ink">
                          <Link href={href} className="hover:text-primary transition-colors">
                            {row.listing_title}
                          </Link>
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right font-semibold text-ink-muted tabular-nums">
                          {row.today_count.toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right font-semibold text-ink-muted tabular-nums">
                          {row.week_count.toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right font-bold text-ink tabular-nums">
                          {row.month_count.toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right font-semibold text-ink-muted tabular-nums">
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
        <div className="bg-raised rounded-2xl border border-line p-8 text-center">
          <p className="text-sm text-ink-muted font-semibold">
            View analytics will appear after students visit your listings.
          </p>
        </div>
      )}
    </div>
  );
}
